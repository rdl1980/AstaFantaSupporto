-- Migrazione: i due intervalli del conteggio diventano indipendenti.
--
-- Prima esisteva un solo `intervallo_secondi` usato sia fra "uno" e "due" sia
-- fra "due" e "tre". Ora sono due impostazioni distinte. Da eseguire una volta
-- sola su un progetto gia' avviato; su un database nuovo basta 01-schema.sql.
--
-- Dopo questo file va rieseguito 02-functions.sql.

alter table sessione add column if not exists secondi_1_2 int not null default 3;
alter table sessione add column if not exists secondi_2_3 int not null default 3;

-- Le sessioni esistenti conservano la cadenza che avevano
do $$
begin
  if exists (select 1 from information_schema.columns
             where table_name = 'sessione' and column_name = 'intervallo_secondi') then
    update sessione set secondi_1_2 = intervallo_secondi, secondi_2_3 = intervallo_secondi;
    alter table sessione drop column intervallo_secondi;
  end if;
end $$;

alter table sessione add constraint sessione_secondi_1_2_check check (secondi_1_2 >= 1);
alter table sessione add constraint sessione_secondi_2_3_check check (secondi_2_3 >= 1);

-- Le vecchie versioni delle funzioni restano in giro: Postgres tiene separate le
-- firme con parametri diversi, e quelle vecchie puntano a una colonna che non
-- esiste piu'. Vanno eliminate, altrimenti restano li' a fallire.
drop function if exists crea_sessione(text, text, int, jsonb, text[], int, int, int);
drop function if exists aggiorna_impostazioni(uuid, text, int, int, int);
