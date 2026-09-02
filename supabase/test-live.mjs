/**
 * Collaudo end-to-end contro il progetto Supabase vero.
 * Usa la chiave anon, cioè esattamente la stessa strada dell'app.
 *
 *   node --env-file=.env supabase/test-live.mjs
 *
 * Crea una sessione di prova (nome "PROVA AUTOMATICA"): non tocca le sessioni
 * reali e può essere eseguito quante volte si vuole.
 */
import { createClient } from '@supabase/supabase-js'

const url = process.env.VITE_SUPABASE_URL
const key = process.env.VITE_SUPABASE_ANON_KEY
if (!url || !key) {
  console.error('Mancano VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY (usa --env-file=.env)')
  process.exit(1)
}

const db = createClient(url, key, { auth: { persistSession: false } })

let passati = 0
let falliti = 0
const verifica = (d, c, extra = '') => {
  if (c) {
    passati++
    console.log(`  ok   ${d}`)
  } else {
    falliti++
    console.log(`  FAIL ${d}${extra ? ' → ' + extra : ''}`)
  }
}
const rpc = async (nome, args) => {
  const { data, error } = await db.rpc(nome, args)
  if (error) throw new Error(`${nome}: ${error.message}`)
  return data
}

console.log('\n== Creazione sessione ==')
const t0 = Date.now()
const sess = await rpc('crea_sessione', {
  p_nome: 'PROVA AUTOMATICA',
  p_modalita: 'classic',
  p_budget: 4000,
  p_slot_config: { slot: { P: 6, D: 8, C: 9, A: 6 } },
  p_squadre: ['Prova A', 'Prova B', 'Prova C'],
  p_rilancio_minimo: 1,
  p_attesa_secondi: 5,
  p_intervallo_secondi: 3,
})
verifica('crea_sessione risponde', sess?.ok === true, JSON.stringify(sess))
verifica(`tempo di risposta accettabile (${Date.now() - t0}ms)`, Date.now() - t0 < 3000)
const sid = sess.sessione_id
const admin = sess.admin_token
console.log(`  codice stanza: ${sess.codice}`)

console.log('\n== I segreti non sono leggibili con la chiave anon ==')
const segS = await db.from('sessione_segreto').select('*')
const segQ = await db.from('squadra_segreto').select('*')
verifica('sessione_segreto non restituisce righe (RLS attiva)', (segS.data ?? []).length === 0, JSON.stringify(segS.data))
verifica('squadra_segreto non restituisce righe (RLS attiva)', (segQ.data ?? []).length === 0, JSON.stringify(segQ.data))

const { data: righeSess } = await db.from('sessione').select('*').eq('id', sid)
verifica(
  'la riga di sessione non contiene admin_token',
  !JSON.stringify(righeSess).includes(admin),
  Object.keys(righeSess?.[0] ?? {}).join(','),
)

const { data: squadre } = await db.from('squadra').select('*').eq('sessione_id', sid).order('ordine')
verifica('3 squadre create', squadre?.length === 3)
verifica('la squadra espone solo il flag presa', 'presa' in (squadre?.[0] ?? {}) && !('claim_token' in (squadre?.[0] ?? {})))

console.log('\n== Scrittura diretta vietata al client ==')
const insDiretto = await db.from('assegnazione').insert({
  sessione_id: sid, squadra_id: squadre[0].id, giocatore_id: 1,
  giocatore_nome: 'Abusivo', club: 'X', ruolo_classic: 'A', prezzo: 1,
})
verifica('insert diretta su assegnazione respinta', !!insDiretto.error, insDiretto.error?.message ?? 'NESSUN ERRORE')
const updDiretto = await db.from('chiamata').update({ offerta_attuale: 9999 }).eq('sessione_id', sid)
verifica('update diretta su chiamata respinta', !!updDiretto.error || (updDiretto.count ?? 0) === 0, updDiretto.error?.message ?? '')

console.log('\n== Realtime ==')
const ricevuti = []
const canale = db.channel(`prova-${sid}`)
  .on('postgres_changes', { event: '*', schema: 'public', table: 'chiamata', filter: `sessione_id=eq.${sid}` },
      (p) => ricevuti.push({ tabella: 'chiamata', evento: p.eventType }))
  .on('postgres_changes', { event: '*', schema: 'public', table: 'assegnazione', filter: `sessione_id=eq.${sid}` },
      (p) => ricevuti.push({ tabella: 'assegnazione', evento: p.eventType }))
const sottoscritto = await new Promise((res) => {
  canale.subscribe((stato) => stato === 'SUBSCRIBED' && res(true))
  setTimeout(() => res(false), 12000)
})
verifica('sottoscrizione realtime stabilita', sottoscritto)
// La replica impiega qualche istante a diventare attiva dopo SUBSCRIBED: senza
// questa pausa i primi eventi si perdono, ed e' il motivo per cui l'app
// rilegge comunque tutto a intervalli regolari.
await new Promise((r) => setTimeout(r, 3000))

console.log('\n== Chiamata e rilanci ==')
const tokA = (await rpc('rivendica_squadra', { p_squadra: squadre[0].id })).claim_token
const tokB = (await rpc('rivendica_squadra', { p_squadra: squadre[1].id })).claim_token
verifica('due squadre rivendicate', !!tokA && !!tokB)
const doppia = await rpc('rivendica_squadra', { p_squadra: squadre[0].id })
verifica('la stessa squadra non si rivendica due volte', doppia.ok === false)

verifica('metti_all_asta', (await rpc('metti_all_asta', {
  p_sessione: sid, p_admin_token: admin, p_giocatore_id: 5585,
  p_nome: 'Malen', p_club: 'Roma', p_ruolo: 'A', p_ruoli_mantra: 'Pc', p_base: 0,
})).ok === true)

const bid = (squadra, token, offerta) =>
  rpc('rilancia', { p_sessione: sid, p_squadra: squadra, p_claim_token: token, p_offerta: offerta })

const tBid = Date.now()
let r = await bid(squadre[0].id, tokA, 10)
verifica(`rilancio accettato (${Date.now() - tBid}ms)`, r.ok === true, JSON.stringify(r))
r = await bid(squadre[1].id, tokB, 10)
verifica('offerta pari rifiutata', r.ok === false && r.motivo === 'offerta_superata')
r = await bid(squadre[1].id, tokB, 4000)
verifica('offerta oltre il massimo rifiutata', r.ok === false && r.motivo === 'crediti_insufficienti', JSON.stringify(r))
r = await bid(squadre[0].id, 'token-falso', 50)
verifica('token falso rifiutato', r.ok === false && r.motivo === 'non_autorizzato')

console.log('\n== Offerte simultanee (la corsa vera) ==')
const esiti = await Promise.all([
  bid(squadre[1].id, tokB, 20),
  bid(squadre[1].id, tokB, 20),
  bid(squadre[1].id, tokB, 20),
])
const ok = esiti.filter((e) => e.ok).length
verifica('a parità di cifra ne passa esattamente una', ok === 1, JSON.stringify(esiti.map((e) => e.motivo ?? 'ok')))

console.log('\n== Aggiudicazione ==')
const ass = await rpc('assegna', { p_sessione: sid, p_admin_token: admin })
verifica('assegnato al miglior offerente a 20', ass.ok === true && ass.prezzo === 20, JSON.stringify(ass))
const { data: asg } = await db.from('assegnazione').select('*').eq('sessione_id', sid)
verifica('una sola assegnazione registrata', asg?.length === 1 && asg[0].giocatore_nome === 'Malen')

await new Promise((r) => setTimeout(r, 5000))
verifica(
  `eventi realtime ricevuti (${ricevuti.length})`,
  ricevuti.some((e) => e.tabella === 'chiamata') && ricevuti.some((e) => e.tabella === 'assegnazione'),
  JSON.stringify(ricevuti),
)

await db.removeChannel(canale)
console.log(`\n${passati} verifiche superate, ${falliti} fallite`)
console.log(`Sessione di prova: ${sess.codice} (puoi ignorarla o cancellarla)\n`)
process.exit(falliti === 0 ? 0 : 1)
