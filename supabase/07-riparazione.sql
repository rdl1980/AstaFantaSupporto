-- Migrazione: mercato di riparazione.
--
-- A gennaio la sessione live non nasce piu' da zero: le squadre hanno gia' una
-- rosa e crediti diversi fra loro. Due cose servono al server.
--
-- 1. Le rose di partenza, caricate come assegnazioni alla creazione. Cosi' i
--    controlli che gia' funzionano — slot di ruolo pieni, offerta massima —
--    continuano a funzionare senza toccarli.
-- 2. Una rettifica per squadra. Il budget della sessione e' uguale per tutti
--    (budget iniziale + budget aggiuntivo di riparazione), ma uno svincolo
--    rimborsato meno di quanto era costato lascia una perdita che e' diversa da
--    squadra a squadra, e va tolta solo a chi l'ha subita.
--
-- Da eseguire una volta sola su un progetto gia' avviato. Dopo questo file va
-- rieseguito 02-functions.sql.

-- Scostamento dal budget di sessione, con segno. Negativo per le perdite degli
-- svincoli; positivo se un giorno servisse un budget extra per classifica.
alter table squadra add column if not exists rettifica int not null default 0;

-- La firma vecchia va eliminata: ne nasce una con due parametri in piu', e
-- Postgres terrebbe vive entrambe restando libero di scegliere quella sbagliata.
drop function if exists crea_sessione(text, text, int, jsonb, text[], int, int, int, int, int[], int);
