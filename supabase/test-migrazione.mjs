/**
 * Collaudo delle migrazioni su un database gia' avviato.
 *
 * Esiste per un guasto vero: dopo la migrazione dei tempi separati, le vecchie
 * firme delle funzioni erano rimaste in giro e Postgres continuava a sceglierle,
 * cercando una colonna che non c'era piu'. Da allora ogni migrazione elimina le
 * firme che sostituisce, e questo file verifica che lo faccia davvero.
 *
 * Il "prima" non si ricostruisce ritagliando i file di oggi — con cinque
 * migrazioni alle spalle diventa un esercizio di equilibrismo sul testo. Si
 * parte dallo schema attuale, si tolgono con `drop column` le colonne che le
 * migrazioni aggiungono, e si piantano le firme storiche come funzioni fittizie.
 * Quello che conta e' che la migrazione trovi un database messo come il tuo.
 *
 *   node supabase/test-migrazione.mjs
 */
import { readFileSync } from 'fs'
import { PGlite } from '@electric-sql/pglite'

const leggi = (f) => readFileSync(new URL(f, import.meta.url), 'utf8')

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

// --- il database com'era -----------------------------------------------------
await db.exec(leggi('./01-schema.sql'))
await db.exec(`
  alter table sessione drop column rilanci_rapidi, drop column attesa_offerta_ms;
  alter table chiamata drop column rimanenza_ms;
  alter table squadra  drop column rettifica;
`)

// Una sessione che esisteva gia', inserita a mano: le funzioni di allora non ci
// sono piu', e ricrearle servirebbe solo a rimetterle in piedi per buttarle via.
const sid = (
  await db.query(`
    insert into sessione (codice, nome, modalita, budget, slot_config, stato)
      values ('VECCHI', 'Asta di settembre', 'classic', 4000,
              '{"slot":{"P":6,"D":8,"C":9,"A":6}}'::jsonb, 'active')
      returning id`)
).rows[0].id
await db.query(`insert into sessione_segreto (sessione_id, admin_token) values ($1, 'tok-admin')`, [sid])
await db.query(`insert into squadra (sessione_id, nome, ordine) values ($1,'Real Sconcerto',1), ($1,'Gennaro',2)`, [sid])
await db.query('insert into chiamata (sessione_id) values ($1)', [sid])
verifica('database ricostruito com era prima delle migrazioni', !!sid)

// Le firme storiche, piantate come funzioni fittizie: e' esattamente cio' che
// le migrazioni devono ripulire.
const firmeStoriche = [
  'crea_sessione(text, text, int, jsonb, text[], int, int, int)',
  'crea_sessione(text, text, int, jsonb, text[], int, int, int, int)',
  'crea_sessione(text, text, int, jsonb, text[], int, int, int, int, int[], int)',
  'aggiorna_impostazioni(uuid, text, int, int, int)',
  'aggiorna_impostazioni(uuid, text, int, int, int, int)',
  'rilancia(uuid, uuid, text, int)',
]
for (const firma of firmeStoriche) {
  await db.exec(`create function ${firma} returns jsonb language sql as $$ select null::jsonb $$;`)
}
verifica(`${firmeStoriche.length} firme vecchie piantate in giro`, true)

// --- le migrazioni, due volte di fila ----------------------------------------
// Rieseguirle per sbaglio capita: non deve rompere nulla.
const migrazioni = ['./04-tempi-separati.sql', './05-rilanci-rapidi.sql', './06-pausa.sql', './07-riparazione.sql']
for (const giro of [1, 2]) {
  for (const m of migrazioni) await db.exec(leggi(m))
  await db.exec(leggi('./02-functions.sql'))
  verifica(`migrazioni ${migrazioni.length} + rifacimento 02, giro ${giro}`, true)
}

// --- cosa deve risultare -----------------------------------------------------
const colonne = async (tabella) =>
  (
    await db.query('select column_name from information_schema.columns where table_name = $1', [tabella])
  ).rows.map((r) => r.column_name)

const cs = await colonne('sessione')
verifica('05: la sessione ha gli scalini e il blocco', cs.includes('rilanci_rapidi') && cs.includes('attesa_offerta_ms'), cs.join(','))
verifica('06: la chiamata ha il campo che congela', (await colonne('chiamata')).includes('rimanenza_ms'))
verifica('07: la squadra ha la rettifica', (await colonne('squadra')).includes('rettifica'))

const riga = (await db.query('select rilanci_rapidi, attesa_offerta_ms from sessione where id=$1', [sid])).rows[0]
verifica(
  'la sessione preesistente riceve i valori predefiniti',
  JSON.stringify(riga.rilanci_rapidi) === '[1,5,10]' && riga.attesa_offerta_ms === 800,
  JSON.stringify(riga),
)
const sq = (await db.query('select rettifica from squadra where sessione_id=$1 limit 1', [sid])).rows[0]
verifica('e le squadre preesistenti una rettifica a zero', sq.rettifica === 0, String(sq.rettifica))

// Il guasto da cui nasce questo file.
for (const nome of ['crea_sessione', 'aggiorna_impostazioni', 'rilancia', 'sospendi_asta', 'riprendi_asta']) {
  const n = (await db.query('select count(*)::int c from pg_proc where proname = $1', [nome])).rows[0].c
  verifica(`una sola firma di ${nome}`, n === 1, `${n} firme`)
}

// --- e le funzioni nuove devono lavorare sui dati vecchi ----------------------
const esito = (await db.query(`select rilancia($1::uuid, gen_random_uuid(), 'x', 5, 1) as r`, [sid])).rows[0].r
verifica('rilancia accetta il parametro versione', esito && esito.ok === false, JSON.stringify(esito))

const sosp = (await db.query('select sospendi_asta($1::uuid, $2) as r', [sid, 'tok-admin'])).rows[0].r
verifica('una sessione preesistente si sospende', sosp.ok === true, JSON.stringify(sosp))
verifica('e si riprende', (await db.query('select riprendi_asta($1::uuid, $2) as r', [sid, 'tok-admin'])).rows[0].r.ok === true)

// 07: una sessione di riparazione nasce con le rose gia' dentro
const rip = (
  await db.query(`
    select crea_sessione('Riparazione','classic',4500,'{"slot":{"P":6,"D":8,"C":9,"A":6}}'::jsonb,
      array['A','B'], 1, 5, 3, 3, '{1,5,10}', 800,
      '[{"ordine":1,"giocatore_id":900,"nome":"Leao","club":"Milan","ruolo":"A","prezzo":200}]'::jsonb,
      '{-120, 0}') as r`)
).rows[0].r
verifica('sessione di riparazione creata', rip.ok === true, JSON.stringify(rip))
const asg = (await db.query('select * from assegnazione where sessione_id=$1', [rip.sessione_id])).rows
verifica('la rosa di partenza e dentro', asg.length === 1 && asg[0].giocatore_nome === 'Leao' && asg[0].prezzo === 200, JSON.stringify(asg))
const rett = (await db.query('select ordine, rettifica from squadra where sessione_id=$1 order by ordine', [rip.sessione_id])).rows
verifica('le rettifiche finiscono sulla squadra giusta', rett[0].rettifica === -120 && rett[1].rettifica === 0, JSON.stringify(rett))

// budget 4500, rettifica -120, speso 200, restano 28 slot da riempire
const max = (await db.query('select _offerta_massima($1::uuid, $2::uuid) as m', [rip.sessione_id, asg[0].squadra_id])).rows[0].m
verifica('l offerta massima tiene conto della rettifica', max === 4500 - 120 - 200 - 27, String(max))

console.log(`\n${passati} verifiche superate, ${falliti} fallite\n`)
process.exit(falliti === 0 ? 0 : 1)
