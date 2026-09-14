/**
 * Collaudo della migrazione su un database gia' avviato.
 *
 * Ricostruisce lo schema com'era *prima* dei rilanci rapidi, ci crea sopra una
 * sessione con le funzioni vecchie, poi applica 05 + 02 come farebbe chi ha gia'
 * un progetto Supabase in piedi. Due volte, perche' una migrazione rieseguita
 * per sbaglio non deve rompere nulla.
 *
 * Esiste per un guasto vero: dopo la migrazione dei tempi separati, le vecchie
 * firme delle funzioni erano rimaste in giro e Postgres continuava a sceglierle,
 * cercando una colonna che non c'era piu'.
 *
 *   node supabase/test-migrazione.mjs
 */
import { readFileSync } from 'fs'
import { PGlite } from '@electric-sql/pglite'

// Le fine riga di Windows renderebbero fragili i ritagli qui sotto
const leggi = (f) => readFileSync(new URL(f, import.meta.url), 'utf8').split('\r\n').join('\n')

let passati = 0
let falliti = 0
function verifica(descrizione, condizione, dettaglio = '') {
  if (condizione) {
    passati++
    console.log(`  ok   ${descrizione}`)
  } else {
    falliti++
    console.log(`  FAIL ${descrizione}${dettaglio ? ' → ' + dettaglio : ''}`)
  }
}

const db = await PGlite.create()

// --- lo schema com'era prima ------------------------------------------------
const schemaVecchio = leggi('./01-schema.sql').replace(
  /  -- scalini del rilancio[\s\S]*?attesa_offerta_ms between 0 and 5000\),\n/,
  '',
)
if (schemaVecchio.includes('rilanci_rapidi')) throw new Error('ritaglio dello schema fallito')
await db.exec(schemaVecchio)

const funzioniVecchie = leggi('./02-functions.sql')
  .replace(",\n  p_rilanci_rapidi int[] default '{1,5,10}', p_attesa_offerta_ms int default 800", '')
  .replace(',\n  p_rilanci_rapidi int[] default null, p_attesa_offerta_ms int default null', '')
  .replace(',\n                        rilanci_rapidi, attesa_offerta_ms, stato', ',\n                        stato')
  .replace(",\n            p_rilanci_rapidi, p_attesa_offerta_ms, 'active'", ", 'active'")
  .replace(
    ',\n                      rilanci_rapidi = coalesce(p_rilanci_rapidi, rilanci_rapidi),' +
      '\n                      attesa_offerta_ms = coalesce(' +
      '\n                        least(5000, greatest(0, p_attesa_offerta_ms)), attesa_offerta_ms)',
    '',
  )
  .replace(',\n  p_versione_attesa int default null', '')
  // Anche il controllo dentro al corpo: la funzione "vecchia" non puo' citare un
  // parametro che non ha piu'.
  .replace(/\n  -- Un rilancio rapido[\s\S]*?'versione', c\.versione\);\n  end if;\n/, '\n')
if (funzioniVecchie.includes('p_versione_attesa')) throw new Error('ritaglio delle funzioni fallito')
await db.exec(funzioniVecchie)

const sess = await db.query(
  `select crea_sessione('Vecchia','classic',4000,'{"slot":{"P":6,"D":8,"C":9,"A":6}}'::jsonb,array['A','B']) as r`,
)
const sid = sess.rows[0].r.sessione_id
verifica('sessione creata con le funzioni precedenti', !!sid)

// --- la migrazione, due volte ----------------------------------------------
for (const giro of [1, 2]) {
  await db.exec(leggi('./05-rilanci-rapidi.sql'))
  await db.exec(leggi('./02-functions.sql'))
  verifica(`migrazione 05 + rifacimento 02, giro ${giro}`, true)
}

const riga = (await db.query('select rilanci_rapidi, attesa_offerta_ms from sessione where id=$1', [sid])).rows[0]
verifica(
  'la sessione preesistente riceve gli scalini predefiniti',
  JSON.stringify(riga.rilanci_rapidi) === '[1,5,10]' && riga.attesa_offerta_ms === 800,
  JSON.stringify(riga),
)

// Il guasto da cui nasce questo file: una firma vecchia rimasta viva accanto
// alla nuova, con Postgres libero di scegliere quella sbagliata.
const firme = await db.query(
  `select proname, count(*)::int c from pg_proc
     where proname in ('rilancia','crea_sessione','aggiorna_impostazioni')
     group by proname order by proname`,
)
for (const f of firme.rows) {
  verifica(`una sola firma di ${f.proname}`, f.c === 1, `${f.c} firme`)
}

const esito = (await db.query(`select rilancia($1::uuid, gen_random_uuid(), 'x', 5, 1) as r`, [sid])).rows[0].r
verifica('rilancia accetta il parametro versione dopo la migrazione', esito && esito.ok === false, JSON.stringify(esito))

console.log(`\n${passati} verifiche superate, ${falliti} fallite\n`)
process.exit(falliti === 0 ? 0 : 1)
