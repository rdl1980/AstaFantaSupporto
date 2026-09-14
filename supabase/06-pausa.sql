-- Migrazione: pausa dell'asta live.
--
-- Lo stato 'paused' esisteva gia' nello schema e non lo usava nessuno. Serve
-- appena qualcuno si alza da tavola o nasce una discussione: il conteggio si
-- ferma, le offerte vengono rifiutate, e alla ripresa si riparte dal punto
-- esatto in cui ci si era fermati.
--
-- Da eseguire una volta sola su un progetto gia' avviato. Dopo questo file va
-- rieseguito 02-functions.sql.

-- Secondi (in millisecondi) che mancavano al martello quando si e' sospeso.
-- La scadenza e' un istante assoluto e durante la pausa scorrerebbe via: quello
-- che va conservato e' il tempo rimasto, non il momento in cui sarebbe scaduta.
alter table chiamata add column if not exists rimanenza_ms int;

-- La vecchia firma di rilancia va eliminata a ogni giro in cui cambia il corpo
-- con nuovi motivi di rifiuto: restando in giro Postgres potrebbe sceglierla.
drop function if exists rilancia(uuid, uuid, text, int);
