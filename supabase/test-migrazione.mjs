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
const schemaVecchio = leggi('./01-schema.sql')
  .replace(/  -- scalini del rilancio[\s\S]*?attesa_offerta_ms between 0 and 5000\),\n/, '')
  .replace(/  -- Millisecondi che mancavano[\s\S]*?rimanenza_ms {9}int,\n/, '')
if (schemaVecchio.includes('rilanci_rapidi')) throw new Error('ritaglio dello schema fallito')
if (schemaVecchio.includes('rimanenza_ms')) throw new Error('ritaglio di rimanenza_ms fallito')
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
  // 06: la pausa non esisteva. Si taglia via la sezione in fondo e i due
  // controlli sparsi nel corpo. Sostituzioni di stringa e non espressioni
  // regolari: qui dentro ci sono parentesi, apici e a capo, e una regex che li
  // contenga tutti e' piu' facile da sbagliare che da leggere.
  .replace(`  if c.stato = 'paused' then
    return jsonb_build_object('ok', false, 'motivo', 'asta_sospesa');
  end if;

`, '')
  .replace(`  if s.stato = 'paused' then
    return jsonb_build_object('ok', false, 'motivo', 'asta_sospesa');
  end if;
`, '')
  .replace(/, rimanenza_ms = null/g, '')
  .split('-- ------------------------------------------------------------- pausa')[0]
if (funzioniVecchie.includes('p_versione_attesa')) throw new Error('ritaglio delle funzioni fallito')
if (funzioniVecchie.includes('rimanenza_ms') || funzioniVecchie.includes('sospendi_asta'))
  throw new Error('ritaglio della pausa fallito')
await db.exec(funzioniVecchie)

const sess = await db.query(
  `select crea_sessione('Vecchia','classic',4000,'{"slot":{"P":6,"D":8,"C":9,"A":6}}'::jsonb,array['A','B']) as r`,
)
const sid = sess.rows[0].r.sessione_id
const admin = sess.rows[0].r.admin_token
verifica('sessione creata con le funzioni precedenti', !!sid)

// --- la migrazione, due volte ----------------------------------------------
for (const giro of [1, 2]) {
  await db.exec(leggi('./05-rilanci-rapidi.sql'))
  await db.exec(leggi('./06-pausa.sql'))
  await db.exec(leggi('./02-functions.sql'))
  verifica(`migrazioni 05 + 06 + rifacimento 02, giro ${giro}`, true)
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

// La 06 aggiunge la pausa: il campo che congela e le due funzioni.
const colonne = (await db.query(
  `select column_name from information_schema.columns where table_name = 'chiamata'`,
)).rows.map((r) => r.column_name)
verifica('la chiamata guadagna il campo della pausa', colonne.includes('rimanenza_ms'), colonne.join(','))

for (const nome of ['sospendi_asta', 'riprendi_asta']) {
  const n = (await db.query('select count(*)::int c from pg_proc where proname = $1', [nome])).rows[0].c
  verifica(`${nome} esiste, in una sola firma`, n === 1, String(n))
}

// Una sessione creata prima della pausa deve poter essere sospesa lo stesso
const prova = (await db.query('select sospendi_asta($1::uuid, $2) as r', [sid, admin])).rows[0].r
verifica('una sessione preesistente si sospende', prova.ok === true, JSON.stringify(prova))
verifica(
  'e si riprende',
  (await db.query('select riprendi_asta($1::uuid, $2) as r', [sid, admin])).rows[0].r.ok === true,
)

console.log(`\n${passati} verifiche superate, ${falliti} fallite\n`)
process.exit(falliti === 0 ? 0 : 1)
