-- Migrazione: rilanci rapidi, attesa dopo il cambio prezzo, offerte legate alla
-- versione della chiamata.
--
-- Nasce dai guasti visti nell'asta del 2026: chi rilanciava un istante prima
-- del "tre" si aggiudicava il giocatore senza far ripartire il conteggio, e chi
-- toccava "+1" mentre il prezzo si muoveva finiva per offrire una cifra che non
-- aveva mai letto.
--
-- Da eseguire una volta sola su un progetto gia' avviato; su un database nuovo
-- basta 01-schema.sql. Dopo questo file va rieseguito 02-functions.sql.

-- Scalini del rilancio rapido, mostrati come pulsanti sul telefono.
alter table sessione add column if not exists rilanci_rapidi int[] not null default '{1,5,10}';

-- Millisecondi di blocco dei pulsanti dopo che il prezzo e' cambiato: il tempo
-- di accorgersi che il numero sotto il dito si e' mosso.
alter table sessione add column if not exists attesa_offerta_ms int not null default 800;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'sessione_attesa_offerta_check') then
    alter table sessione add constraint sessione_attesa_offerta_check
      check (attesa_offerta_ms between 0 and 5000);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'sessione_rilanci_rapidi_check') then
    alter table sessione add constraint sessione_rilanci_rapidi_check
      check (array_length(rilanci_rapidi, 1) between 1 and 4);
  end if;
end $$;

-- Le firme vecchie vanno eliminate: Postgres tiene separate le funzioni con
-- parametri diversi, e quelle restano a scrivere su una sessione a cui manca
-- meta' configurazione.
drop function if exists crea_sessione(text, text, int, jsonb, text[], int, int, int, int);
drop function if exists aggiorna_impostazioni(uuid, text, int, int, int, int);
drop function if exists rilancia(uuid, uuid, text, int);
