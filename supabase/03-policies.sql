-- Asta Live Sincronizzata — permessi
--
-- Impostazione di fondo: il client **non scrive mai** direttamente. Legge le
-- tabelle per mostrare il tabellone, e ogni modifica passa dalle funzioni
-- `security definer` del file 02, che verificano token e regole.
--
-- La chiave anon di Supabase e' visibile nel bundle: e' inevitabile in un'app
-- senza backend. La protezione sta qui e nelle funzioni, non nel nascondere la
-- chiave. Per questo i token non abitano nelle tabelle leggibili.

alter table sessione         enable row level security;
alter table squadra          enable row level security;
alter table assegnazione     enable row level security;
alter table chiamata         enable row level security;
alter table sessione_segreto enable row level security;
alter table squadra_segreto  enable row level security;

-- Lettura aperta sulle tabelle di gioco: per vedere qualcosa serve conoscere il
-- codice della stanza, e il contenuto sono nomi di calciatori e prezzi.
create policy "lettura sessione"     on sessione     for select using (true);
create policy "lettura squadra"      on squadra      for select using (true);
create policy "lettura assegnazione" on assegnazione for select using (true);
create policy "lettura chiamata"     on chiamata     for select using (true);

-- Sulle tabelle dei segreti non c'e' nessuna policy: con RLS attiva e nessuna
-- regola, il client non le legge e non le scrive in alcun modo. Vi accedono
-- solo le funzioni `security definer`.

-- Nessuna policy di insert/update/delete da nessuna parte: le scritture
-- restano possibili unicamente attraverso le funzioni.

-- Realtime: le tabelle vanno pubblicate perche' i client ricevano i cambiamenti.
-- Le tabelle dei segreti restano fuori, cosi' nessun token viaggia mai.
alter publication supabase_realtime add table assegnazione;
alter publication supabase_realtime add table chiamata;
alter publication supabase_realtime add table squadra;
alter publication supabase_realtime add table sessione;
