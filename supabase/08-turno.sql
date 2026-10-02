-- Migrazione: turno di chiamata.
--
-- Molte leghe chiamano a giro invece che a sorteggio, e tenere il conto a voce
-- e' una fonte sicura di litigi: a meta' asta nessuno ricorda se il giro era
-- arrivato a chi si era alzato per il caffe'.
--
-- Il turno sta sul server e non sui dispositivi perche' tutti devono leggere lo
-- stesso nome. Calcolarlo in locale significherebbe otto telefoni che si
-- contraddicono appena uno perde un messaggio, che e' precisamente il litigio
-- che questa cosa dovrebbe togliere.
--
-- Da eseguire una volta sola su un progetto gia' avviato. Dopo questo file va
-- rieseguito 02-functions.sql.

-- `ordine` della squadra che deve chiamare adesso. Null quando la lega non
-- chiama a giro: una colonna in piu' e niente di diverso per chi non la usa.
alter table sessione add column if not exists turno int;

-- La firma vecchia va eliminata: ne nasce una con un parametro in piu', e
-- Postgres terrebbe vive entrambe restando libero di scegliere quella sbagliata.
drop function if exists crea_sessione(text, text, int, jsonb, text[], int, int, int, int, int[], int, jsonb, int[]);
