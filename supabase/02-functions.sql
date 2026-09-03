-- Asta Live Sincronizzata — funzioni
--
-- Tutte le scritture passano da qui: il client non tocca mai direttamente le
-- tabelle. Le funzioni sono `security definer` perche' devono poter leggere e
-- scrivere righe che le policy negherebbero al client anonimo.

-- Orologio del server: i client lo usano per calcolare lo scarto rispetto al
-- proprio, altrimenti un telefono con l'ora sbagliata mostrerebbe un conteggio
-- diverso da tutti gli altri.
create or replace function ora_server()
returns timestamptz language sql stable as $$
  select now()
$$;

create or replace function _token()
returns text language sql volatile as $$
  select replace(gen_random_uuid()::text, '-', '')
$$;

create or replace function _slot_totali(p_config jsonb, p_modalita text)
returns int language sql immutable as $$
  select case
    when p_modalita = 'mantra'
      then coalesce((p_config->>'portieri')::int, 0) + coalesce((p_config->>'movimento')::int, 0)
    else coalesce((p_config->'slot'->>'P')::int, 0) + coalesce((p_config->'slot'->>'D')::int, 0)
       + coalesce((p_config->'slot'->>'C')::int, 0) + coalesce((p_config->'slot'->>'A')::int, 0)
  end
$$;

-- true se la squadra ha gia' esaurito gli slot per quel ruolo.
-- In Mantra i ruoli di movimento non hanno quote separate: conta solo la
-- divisione fra portieri e resto della rosa.
create or replace function _slot_ruolo_pieno(
  p_sessione uuid, p_squadra uuid, p_ruolo text
) returns boolean language plpgsql stable as $$
declare
  s          sessione%rowtype;
  v_presi    int;
  v_limite   int;
begin
  select * into s from sessione where id = p_sessione;

  if s.modalita = 'mantra' then
    if p_ruolo = 'P' then
      select count(*) into v_presi from assegnazione
        where squadra_id = p_squadra and ruolo_classic = 'P';
      v_limite := coalesce((s.slot_config->>'portieri')::int, 0);
    else
      select count(*) into v_presi from assegnazione
        where squadra_id = p_squadra and ruolo_classic <> 'P';
      v_limite := coalesce((s.slot_config->>'movimento')::int, 0);
    end if;
  else
    select count(*) into v_presi from assegnazione
      where squadra_id = p_squadra and ruolo_classic = p_ruolo;
    v_limite := coalesce((s.slot_config->'slot'->>p_ruolo)::int, 0);
  end if;

  return v_presi >= v_limite;
end
$$;

-- Massimo che una squadra puo' offrire: i crediti residui meno un credito per
-- ogni altro slot ancora da riempire. E' la stessa regola di maxBidFor lato
-- client, ripetuta qui perche' il client non puo' essere creduto sulla parola.
create or replace function _offerta_massima(p_sessione uuid, p_squadra uuid)
returns int language plpgsql stable as $$
declare
  s              sessione%rowtype;
  v_spesi        int;
  v_presi        int;
  v_slot_rimasti int;
begin
  select * into s from sessione where id = p_sessione;
  select coalesce(sum(prezzo), 0), count(*) into v_spesi, v_presi
    from assegnazione where squadra_id = p_squadra;
  v_slot_rimasti := _slot_totali(s.slot_config, s.modalita) - v_presi;
  return greatest(0, (s.budget - v_spesi) - greatest(0, v_slot_rimasti - 1));
end
$$;

-- ---------------------------------------------------------------- sessione --

create or replace function crea_sessione(
  p_nome text, p_modalita text, p_budget int, p_slot_config jsonb,
  p_squadre text[], p_rilancio_minimo int default 1,
  p_attesa_secondi int default 5, p_secondi_1_2 int default 3, p_secondi_2_3 int default 3
) returns jsonb language plpgsql security definer as $$
declare
  v_id     uuid;
  v_codice text;
  v_admin  text := _token();
  i        int;
begin
  for attempt in 1..10 loop
    v_codice := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
    exit when not exists (select 1 from sessione where codice = v_codice);
    v_codice := null;
  end loop;
  if v_codice is null then
    return jsonb_build_object('ok', false, 'motivo', 'codice_non_generato');
  end if;

  insert into sessione (codice, nome, modalita, budget, slot_config, rilancio_minimo,
                        attesa_secondi, secondi_1_2, secondi_2_3, stato)
    values (v_codice, p_nome, p_modalita, p_budget, p_slot_config, p_rilancio_minimo,
            p_attesa_secondi, p_secondi_1_2, p_secondi_2_3, 'active')
    returning id into v_id;

  insert into sessione_segreto (sessione_id, admin_token) values (v_id, v_admin);

  for i in 1 .. array_length(p_squadre, 1) loop
    insert into squadra (sessione_id, nome, ordine) values (v_id, p_squadre[i], i);
  end loop;

  insert into chiamata (sessione_id) values (v_id);

  return jsonb_build_object('ok', true, 'sessione_id', v_id, 'codice', v_codice,
                            'admin_token', v_admin);
end
$$;

create or replace function aggiorna_impostazioni(
  p_sessione uuid, p_admin_token text,
  p_rilancio_minimo int, p_attesa_secondi int, p_secondi_1_2 int, p_secondi_2_3 int
) returns jsonb language plpgsql security definer as $$
begin
  if not exists (select 1 from sessione_segreto where sessione_id = p_sessione and admin_token = p_admin_token) then
    return jsonb_build_object('ok', false, 'motivo', 'non_autorizzato');
  end if;
  update sessione set rilancio_minimo = greatest(1, p_rilancio_minimo),
                      attesa_secondi = greatest(0, p_attesa_secondi),
                      secondi_1_2 = greatest(1, p_secondi_1_2),
                      secondi_2_3 = greatest(1, p_secondi_2_3)
    where id = p_sessione;
  return jsonb_build_object('ok', true);
end
$$;

-- Rivendica una squadra dal proprio dispositivo. Riesce una volta sola.
create or replace function rivendica_squadra(p_squadra uuid)
returns jsonb language plpgsql security definer as $$
declare v_token text := _token(); v_agg int;
begin
  -- L'update condizionato e' anche il lucchetto: due dispositivi che scelgono
  -- la stessa squadra nello stesso istante non possono riuscire entrambi.
  update squadra set presa = true where id = p_squadra and presa = false;
  get diagnostics v_agg = row_count;
  if v_agg = 0 then
    return jsonb_build_object('ok', false, 'motivo', 'squadra_gia_presa');
  end if;
  insert into squadra_segreto (squadra_id, claim_token) values (p_squadra, v_token);
  return jsonb_build_object('ok', true, 'claim_token', v_token);
end
$$;

-- ------------------------------------------------------------ assegnazioni --

-- Fase 1: il banditore pubblica un acquisto deciso fuori dall'app.
create or replace function pubblica_assegnazione(
  p_sessione uuid, p_admin_token text, p_squadra uuid,
  p_giocatore_id int, p_nome text, p_club text, p_ruolo text,
  p_ruoli_mantra text, p_prezzo int
) returns jsonb language plpgsql security definer as $$
begin
  if not exists (select 1 from sessione_segreto where sessione_id = p_sessione and admin_token = p_admin_token) then
    return jsonb_build_object('ok', false, 'motivo', 'non_autorizzato');
  end if;

  insert into assegnazione (sessione_id, squadra_id, giocatore_id, giocatore_nome,
                            club, ruolo_classic, ruoli_mantra, prezzo)
    values (p_sessione, p_squadra, p_giocatore_id, p_nome, p_club, p_ruolo,
            p_ruoli_mantra, p_prezzo)
    on conflict (sessione_id, giocatore_id) do update
      set squadra_id = excluded.squadra_id, prezzo = excluded.prezzo;

  return jsonb_build_object('ok', true);
end
$$;

create or replace function rimuovi_assegnazione(
  p_sessione uuid, p_admin_token text, p_giocatore_id int
) returns jsonb language plpgsql security definer as $$
begin
  if not exists (select 1 from sessione_segreto where sessione_id = p_sessione and admin_token = p_admin_token) then
    return jsonb_build_object('ok', false, 'motivo', 'non_autorizzato');
  end if;
  delete from assegnazione where sessione_id = p_sessione and giocatore_id = p_giocatore_id;
  return jsonb_build_object('ok', true);
end
$$;

-- ---------------------------------------------------------------- chiamata --

create or replace function metti_all_asta(
  p_sessione uuid, p_admin_token text, p_giocatore_id int,
  p_nome text, p_club text, p_ruolo text, p_ruoli_mantra text,
  p_base int default 0
) returns jsonb language plpgsql security definer as $$
declare s sessione%rowtype;
begin
  if not exists (select 1 from sessione_segreto
                 where sessione_id = p_sessione and admin_token = p_admin_token) then
    return jsonb_build_object('ok', false, 'motivo', 'non_autorizzato');
  end if;
  select * into s from sessione where id = p_sessione;
  if exists (select 1 from assegnazione where sessione_id = p_sessione and giocatore_id = p_giocatore_id) then
    return jsonb_build_object('ok', false, 'motivo', 'gia_assegnato');
  end if;

  update chiamata set
    giocatore_id = p_giocatore_id, giocatore_nome = p_nome, club = p_club,
    ruolo_classic = p_ruolo, ruoli_mantra = p_ruoli_mantra,
    offerta_attuale = nullif(p_base, 0), miglior_offerente_id = null,
    stato = 'active',
    scadenza = now() + make_interval(secs => s.attesa_secondi + s.secondi_1_2 + 2 * s.secondi_2_3),
    versione = versione + 1
  where sessione_id = p_sessione;

  return jsonb_build_object('ok', true);
end
$$;

create or replace function annulla_chiamata(p_sessione uuid, p_admin_token text)
returns jsonb language plpgsql security definer as $$
begin
  if not exists (select 1 from sessione_segreto where sessione_id = p_sessione and admin_token = p_admin_token) then
    return jsonb_build_object('ok', false, 'motivo', 'non_autorizzato');
  end if;
  update chiamata set stato = 'idle', giocatore_id = null, giocatore_nome = null,
                      club = null, ruolo_classic = null, ruoli_mantra = null,
                      offerta_attuale = null, miglior_offerente_id = null,
                      scadenza = null, versione = versione + 1
    where sessione_id = p_sessione;
  return jsonb_build_object('ok', true);
end
$$;

-- Cuore della fase 2.
create or replace function rilancia(
  p_sessione uuid, p_squadra uuid, p_claim_token text, p_offerta int
) returns jsonb language plpgsql security definer as $$
declare
  s        sessione%rowtype;
  c        chiamata%rowtype;
  v_minima int;
  v_max    int;
begin
  select * into s from sessione where id = p_sessione;
  if not found then
    return jsonb_build_object('ok', false, 'motivo', 'sessione_inesistente');
  end if;

  -- Il lock e' la coda: due rilanci simultanei si accodano qui e vengono
  -- processati uno alla volta, nell'ordine in cui il server li riceve.
  select * into c from chiamata where sessione_id = p_sessione for update;

  if not exists (select 1 from squadra sq
                 join squadra_segreto ss on ss.squadra_id = sq.id
                 where sq.id = p_squadra and sq.sessione_id = p_sessione
                   and ss.claim_token = p_claim_token) then
    return jsonb_build_object('ok', false, 'motivo', 'non_autorizzato');
  end if;

  if c.stato <> 'active' then
    return jsonb_build_object('ok', false, 'motivo', 'nessuna_chiamata');
  end if;

  if now() >= c.scadenza then
    return jsonb_build_object('ok', false, 'motivo', 'chiamata_scaduta');
  end if;

  if c.miglior_offerente_id = p_squadra then
    return jsonb_build_object('ok', false, 'motivo', 'gia_tua',
                              'offerta_attuale', c.offerta_attuale);
  end if;

  v_minima := coalesce(c.offerta_attuale, 0) + s.rilancio_minimo;
  if p_offerta < v_minima then
    return jsonb_build_object('ok', false,
      'motivo', case when p_offerta <= coalesce(c.offerta_attuale, 0)
                     then 'offerta_superata' else 'rilancio_troppo_basso' end,
      'offerta_attuale', c.offerta_attuale, 'minima', v_minima,
      'versione', c.versione);
  end if;

  if _slot_ruolo_pieno(p_sessione, p_squadra, c.ruolo_classic) then
    return jsonb_build_object('ok', false, 'motivo', 'slot_ruolo_pieni',
                              'ruolo', c.ruolo_classic);
  end if;

  v_max := _offerta_massima(p_sessione, p_squadra);
  if p_offerta > v_max then
    return jsonb_build_object('ok', false, 'motivo', 'crediti_insufficienti',
                              'massimo', v_max);
  end if;

  update chiamata set
    offerta_attuale = p_offerta,
    miglior_offerente_id = p_squadra,
    -- ogni rilancio fa ripartire l'attesa prima del conteggio
    scadenza = now() + make_interval(secs => s.attesa_secondi + s.secondi_1_2 + 2 * s.secondi_2_3),
    versione = versione + 1
  where sessione_id = p_sessione;

  return jsonb_build_object('ok', true, 'offerta', p_offerta, 'versione', c.versione + 1);
end
$$;

-- Aggiudica al miglior offerente. Chiamabile dal banditore o dal suo client
-- quando il conteggio arriva a termine: e' idempotente perche' lavora sotto lo
-- stesso lock e riporta subito la chiamata a 'idle'.
create or replace function assegna(p_sessione uuid, p_admin_token text)
returns jsonb language plpgsql security definer as $$
declare
  c chiamata%rowtype;
begin
  if not exists (select 1 from sessione_segreto where sessione_id = p_sessione and admin_token = p_admin_token) then
    return jsonb_build_object('ok', false, 'motivo', 'non_autorizzato');
  end if;

  select * into c from chiamata where sessione_id = p_sessione for update;

  if c.stato <> 'active' then
    return jsonb_build_object('ok', false, 'motivo', 'nessuna_chiamata');
  end if;
  if c.miglior_offerente_id is null then
    return jsonb_build_object('ok', false, 'motivo', 'nessuna_offerta');
  end if;

  insert into assegnazione (sessione_id, squadra_id, giocatore_id, giocatore_nome,
                            club, ruolo_classic, ruoli_mantra, prezzo)
    values (p_sessione, c.miglior_offerente_id, c.giocatore_id, c.giocatore_nome,
            c.club, c.ruolo_classic, c.ruoli_mantra, c.offerta_attuale)
    on conflict (sessione_id, giocatore_id) do nothing;

  update chiamata set stato = 'idle', giocatore_id = null, giocatore_nome = null,
                      club = null, ruolo_classic = null, ruoli_mantra = null,
                      offerta_attuale = null, miglior_offerente_id = null,
                      scadenza = null, versione = versione + 1
    where sessione_id = p_sessione;

  return jsonb_build_object('ok', true, 'squadra_id', c.miglior_offerente_id,
                            'prezzo', c.offerta_attuale, 'giocatore_id', c.giocatore_id);
end
$$;

-- Chiude una chiamata gia' scaduta, aggiudicando al miglior offerente.
--
-- Non richiede il token del banditore, di proposito: l'aggiudicazione non deve
-- dipendere dal fatto che il suo browser sia sveglio e in primo piano. Qualsiasi
-- client che veda il conteggio finito puo' chiamarla; il server accetta solo se
-- la scadenza e' davvero passata, e il lock rende innocue le chiamate ripetute.
create or replace function aggiudica_se_scaduta(p_sessione uuid)
returns jsonb language plpgsql security definer as $$
declare c chiamata%rowtype;
begin
  select * into c from chiamata where sessione_id = p_sessione for update;
  if not found or c.stato <> 'active' then
    return jsonb_build_object('ok', false, 'motivo', 'nessuna_chiamata');
  end if;
  if c.scadenza is null or now() < c.scadenza then
    return jsonb_build_object('ok', false, 'motivo', 'non_ancora_scaduta');
  end if;

  if c.miglior_offerente_id is not null then
    insert into assegnazione (sessione_id, squadra_id, giocatore_id, giocatore_nome,
                              club, ruolo_classic, ruoli_mantra, prezzo)
      values (p_sessione, c.miglior_offerente_id, c.giocatore_id, c.giocatore_nome,
              c.club, c.ruolo_classic, c.ruoli_mantra, c.offerta_attuale)
      on conflict (sessione_id, giocatore_id) do nothing;
  end if;

  update chiamata set stato = 'idle', giocatore_id = null, giocatore_nome = null,
                      club = null, ruolo_classic = null, ruoli_mantra = null,
                      offerta_attuale = null, miglior_offerente_id = null,
                      scadenza = null, versione = versione + 1
    where sessione_id = p_sessione;

  return jsonb_build_object('ok', true, 'squadra_id', c.miglior_offerente_id,
                            'prezzo', c.offerta_attuale, 'giocatore_id', c.giocatore_id);
end
$$;
