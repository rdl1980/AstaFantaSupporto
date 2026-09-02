-- Asta Live Sincronizzata — schema
-- Da eseguire nell'SQL Editor del progetto Supabase, in ordine: 01, 02, 03.

create table if not exists sessione (
  id                 uuid primary key default gen_random_uuid(),
  codice             text unique not null,
  nome               text not null,
  modalita           text not null check (modalita in ('mantra', 'classic')),
  budget             int  not null check (budget > 0),
  -- classic: {"slot": {"P":6,"D":8,"C":9,"A":6}}
  -- mantra:  {"portieri": 6, "movimento": 29}
  slot_config        jsonb not null,
  rilancio_minimo    int  not null default 1 check (rilancio_minimo >= 1),
  -- secondi dall'ultima offerta all'inizio del conteggio
  attesa_secondi     int  not null default 5 check (attesa_secondi >= 0),
  -- secondi fra un numero e il successivo (1→2, 2→3, 3→aggiudicato)
  intervallo_secondi int  not null default 3 check (intervallo_secondi >= 1),
  stato              text not null default 'idle'
                     check (stato in ('idle', 'active', 'paused', 'closed')),
  creata_il          timestamptz not null default now()
);

-- I segreti stanno fuori dalle tabelle che il client legge. Non e' pignoleria:
-- la lettura e' aperta a chi conosce il codice stanza, e le notifiche realtime
-- spediscono la riga intera a tutti i sottoscrittori. Un token dentro
-- 'sessione' o 'squadra' finirebbe nel telefono di ogni partecipante.
create table if not exists sessione_segreto (
  sessione_id uuid primary key references sessione(id) on delete cascade,
  admin_token text not null
);

create table if not exists squadra (
  id          uuid primary key default gen_random_uuid(),
  sessione_id uuid not null references sessione(id) on delete cascade,
  nome        text not null,
  ordine      int  not null,
  -- indica solo *se* la squadra e' stata rivendicata: il token sta altrove
  presa       boolean not null default false,
  unique (sessione_id, ordine)
);

create table if not exists squadra_segreto (
  squadra_id  uuid primary key references squadra(id) on delete cascade,
  claim_token text not null
);

create table if not exists assegnazione (
  id             uuid primary key default gen_random_uuid(),
  sessione_id    uuid not null references sessione(id) on delete cascade,
  squadra_id     uuid not null references squadra(id) on delete cascade,
  giocatore_id   int  not null,
  -- I dispositivi dei partecipanti non hanno il listone: nome, club e ruoli
  -- vengono copiati qui, altrimenti il tabellone sarebbe illeggibile.
  giocatore_nome text not null,
  club           text not null,
  ruolo_classic  text not null check (ruolo_classic in ('P', 'D', 'C', 'A')),
  ruoli_mantra   text,
  prezzo         int  not null check (prezzo >= 1),
  assegnato_il   timestamptz not null default now(),
  unique (sessione_id, giocatore_id)
);

create index if not exists assegnazione_squadra_idx on assegnazione (squadra_id);

-- Una sola riga per sessione: e' anche il punto su cui si serializzano i rilanci.
create table if not exists chiamata (
  sessione_id          uuid primary key references sessione(id) on delete cascade,
  giocatore_id         int,
  giocatore_nome       text,
  club                 text,
  ruolo_classic        text check (ruolo_classic in ('P', 'D', 'C', 'A')),
  ruoli_mantra         text,
  offerta_attuale      int,
  miglior_offerente_id uuid references squadra(id) on delete set null,
  stato                text not null default 'idle'
                       check (stato in ('idle', 'active', 'paused')),
  -- Istante in cui la chiamata si chiude se nessuno rilancia. Il conteggio
  -- "uno, due, tre" non viene trasmesso: ogni client lo deriva da qui e dalla
  -- configurazione, cosi' tutti vedono la stessa cosa senza bisogno di tick.
  scadenza             timestamptz,
  versione             bigint not null default 0
);
