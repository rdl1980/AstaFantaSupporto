/**
 * Collaudo delle funzioni SQL su Postgres in WASM (PGlite).
 * Esegue lo schema reale e verifica le regole di validazione del rilancio.
 *
 *   node supabase/test-funzioni.mjs
 */
import { readFileSync } from 'fs'
import { PGlite } from '@electric-sql/pglite'

const db = await PGlite.create()
await db.exec(readFileSync(new URL('./01-schema.sql', import.meta.url), 'utf8'))
await db.exec(readFileSync(new URL('./02-functions.sql', import.meta.url), 'utf8'))

const call = async (sql, params = []) => (await db.query(sql, params)).rows[0]
const rpc = async (name, args) => {
  const keys = Object.keys(args)
  const placeholders = keys.map((k, i) => `${k} => $${i + 1}`).join(', ')
  const row = await call(`select ${name}(${placeholders}) as r`, Object.values(args))
  return row.r
}

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

// ---------------------------------------------------------------- scenario --
console.log('\n== Creazione sessione (Classic, 4000 crediti, slot 6/8/9/6) ==')
const sess = await rpc('crea_sessione', {
  p_nome: 'Classic di prova',
  p_modalita: 'classic',
  p_budget: 4000,
  p_slot_config: JSON.stringify({ slot: { P: 6, D: 8, C: 9, A: 6 } }),
  p_squadre: ['Real Sconcerto', 'Bayern Monaco', 'Athletic Bilbaolo'],
  p_rilancio_minimo: 1,
  p_attesa_secondi: 5,
  p_secondi_1_2: 3,
  p_secondi_2_3: 4,
})
verifica('sessione creata', sess.ok)
verifica('codice stanza di 6 caratteri', /^[0-9A-F]{6}$/.test(sess.codice), sess.codice)

const sid = sess.sessione_id
const admin = sess.admin_token
const squadre = (await db.query('select id, nome, ordine from squadra where sessione_id=$1 order by ordine', [sid])).rows
verifica('3 squadre create', squadre.length === 3)

const [A, B, C] = squadre
const tokA = (await rpc('rivendica_squadra', { p_squadra: A.id })).claim_token
const tokB = (await rpc('rivendica_squadra', { p_squadra: B.id })).claim_token
verifica('rivendica squadra: token emesso', !!tokA && !!tokB)
const doppia = await rpc('rivendica_squadra', { p_squadra: A.id })
verifica('seconda rivendica della stessa squadra rifiutata', doppia.ok === false && doppia.motivo === 'squadra_gia_presa')

// ------------------------------------------------------------- la chiamata --
console.log('\n== Chiamata e rilanci ==')
const inAsta = {
  p_sessione: sid, p_admin_token: admin, p_giocatore_id: 100,
  p_nome: 'Malen', p_club: 'Roma', p_ruolo: 'A', p_ruoli_mantra: 'Pc', p_base: 0,
}
verifica('metti_all_asta', (await rpc('metti_all_asta', inAsta)).ok)

let r = await rpc('rilancia', { p_sessione: sid, p_squadra: A.id, p_claim_token: tokA, p_offerta: 10 })
verifica('primo rilancio accettato', r.ok && r.offerta === 10)

r = await rpc('rilancia', { p_sessione: sid, p_squadra: A.id, p_claim_token: tokA, p_offerta: 20 })
verifica('rilancio su se stessi rifiutato', r.ok === false && r.motivo === 'gia_tua')

r = await rpc('rilancia', { p_sessione: sid, p_squadra: B.id, p_claim_token: tokB, p_offerta: 10 })
verifica('offerta pari alla corrente rifiutata', r.ok === false && r.motivo === 'offerta_superata', JSON.stringify(r))

r = await rpc('rilancia', { p_sessione: sid, p_squadra: B.id, p_claim_token: tokB, p_offerta: 8 })
verifica('offerta inferiore rifiutata', r.ok === false && r.motivo === 'offerta_superata')

r = await rpc('rilancia', { p_sessione: sid, p_squadra: B.id, p_claim_token: tokB, p_offerta: 11 })
verifica('rilancio minimo di 1 accettato', r.ok && r.offerta === 11)

r = await rpc('rilancia', { p_sessione: sid, p_squadra: A.id, p_claim_token: 'token-sbagliato', p_offerta: 50 })
verifica('token non valido rifiutato', r.ok === false && r.motivo === 'non_autorizzato')

r = await rpc('rilancia', { p_sessione: sid, p_squadra: C.id, p_claim_token: null, p_offerta: 50 })
verifica('squadra non rivendicata non puo offrire', r.ok === false && r.motivo === 'non_autorizzato')

// ------------------------------------------- la scadenza fa ripartire tutto --
console.log('\n== Scadenza ==')
const prima = await call('select scadenza from chiamata where sessione_id=$1', [sid])
await db.query('select pg_sleep(0)')
r = await rpc('rilancia', { p_sessione: sid, p_squadra: A.id, p_claim_token: tokA, p_offerta: 30 })
const dopo = await call('select scadenza from chiamata where sessione_id=$1', [sid])
verifica('ogni rilancio sposta in avanti la scadenza', new Date(dopo.scadenza) > new Date(prima.scadenza))

// scadenza forzata nel passato
await db.query("update chiamata set scadenza = now() - interval '1 second' where sessione_id=$1", [sid])
r = await rpc('rilancia', { p_sessione: sid, p_squadra: B.id, p_claim_token: tokB, p_offerta: 999 })
verifica('rilancio dopo la scadenza rifiutato', r.ok === false && r.motivo === 'chiamata_scaduta')

// ------------------------------------------------------------ aggiudicazione --
console.log('\n== Aggiudicazione ==')
const ass = await rpc('assegna', { p_sessione: sid, p_admin_token: admin })
verifica('assegna al miglior offerente', ass.ok && ass.squadra_id === A.id && ass.prezzo === 30, JSON.stringify(ass))
const ass2 = await rpc('assegna', { p_sessione: sid, p_admin_token: admin })
verifica('seconda assegna e innocua (idempotente)', ass2.ok === false && ass2.motivo === 'nessuna_chiamata')
const righe = await db.query('select * from assegnazione where sessione_id=$1', [sid])
verifica('una sola riga di assegnazione', righe.rows.length === 1 && righe.rows[0].prezzo === 30)

// ------------------------------------------------------- vincoli di budget --
console.log('\n== Crediti e slot ==')
// A ha speso 30 su 4000 e ha 28 slot ancora liberi su 29 → max = 3970 - 27 = 3943
const max = await call('select _offerta_massima($1,$2) as m', [sid, A.id])
verifica('offerta massima = residui meno un credito per gli altri slot', max.m === 3943, String(max.m))

await rpc('metti_all_asta', { ...inAsta, p_giocatore_id: 101, p_nome: 'Thuram', p_ruolo: 'A' })
r = await rpc('rilancia', { p_sessione: sid, p_squadra: A.id, p_claim_token: tokA, p_offerta: 3944 })
verifica('offerta oltre il massimo rifiutata', r.ok === false && r.motivo === 'crediti_insufficienti' && r.massimo === 3943, JSON.stringify(r))
r = await rpc('rilancia', { p_sessione: sid, p_squadra: A.id, p_claim_token: tokA, p_offerta: 3943 })
verifica('offerta pari al massimo accettata', r.ok === true)
await rpc('annulla_chiamata', { p_sessione: sid, p_admin_token: admin })

// riempio gli attaccanti di B: 6 slot
for (let i = 0; i < 6; i++) {
  await rpc('pubblica_assegnazione', {
    p_sessione: sid, p_admin_token: admin, p_squadra: B.id,
    p_giocatore_id: 200 + i, p_nome: `Att${i}`, p_club: 'X', p_ruolo: 'A',
    p_ruoli_mantra: 'Pc', p_prezzo: 1,
  })
}
verifica('slot attaccanti di B risultano pieni',
  (await call('select _slot_ruolo_pieno($1,$2,$3) as p', [sid, B.id, 'A'])).p === true)
verifica('slot difensori di B ancora liberi',
  (await call('select _slot_ruolo_pieno($1,$2,$3) as p', [sid, B.id, 'D'])).p === false)

await rpc('metti_all_asta', { ...inAsta, p_giocatore_id: 300, p_nome: 'Altro attaccante', p_ruolo: 'A' })
r = await rpc('rilancia', { p_sessione: sid, p_squadra: B.id, p_claim_token: tokB, p_offerta: 5 })
verifica('rilancio su ruolo pieno rifiutato', r.ok === false && r.motivo === 'slot_ruolo_pieni', JSON.stringify(r))
r = await rpc('rilancia', { p_sessione: sid, p_squadra: A.id, p_claim_token: tokA, p_offerta: 5 })
verifica('la stessa chiamata resta valida per chi ha lo slot libero', r.ok === true)

// ------------------------------------------------------------ vincoli Mantra --
console.log('\n== Mantra: portieri e movimento ==')
const sm = await rpc('crea_sessione', {
  p_nome: 'Mantra di prova', p_modalita: 'mantra', p_budget: 4000,
  p_slot_config: JSON.stringify({ portieri: 2, movimento: 3 }),
  p_squadre: ['Uno', 'Due'], p_rilancio_minimo: 1,
  p_attesa_secondi: 5, p_secondi_1_2: 3, p_secondi_2_3: 4,
})
const msid = sm.sessione_id
const msq = (await db.query('select id from squadra where sessione_id=$1 order by ordine', [msid])).rows
for (let i = 0; i < 2; i++) {
  await rpc('pubblica_assegnazione', {
    p_sessione: msid, p_admin_token: sm.admin_token, p_squadra: msq[0].id,
    p_giocatore_id: 400 + i, p_nome: `Por${i}`, p_club: 'X', p_ruolo: 'P',
    p_ruoli_mantra: 'Por', p_prezzo: 10,
  })
}
verifica('portieri pieni a quota 2',
  (await call('select _slot_ruolo_pieno($1,$2,$3) as p', [msid, msq[0].id, 'P'])).p === true)
verifica('i ruoli di movimento non sono toccati dai portieri',
  (await call('select _slot_ruolo_pieno($1,$2,$3) as p', [msid, msq[0].id, 'D'])).p === false)
for (const [i, ruolo] of ['D', 'C', 'A'].entries()) {
  await rpc('pubblica_assegnazione', {
    p_sessione: msid, p_admin_token: sm.admin_token, p_squadra: msq[0].id,
    p_giocatore_id: 500 + i, p_nome: `Mov${i}`, p_club: 'X', p_ruolo: ruolo,
    p_ruoli_mantra: 'E', p_prezzo: 10,
  })
}
verifica('movimento pieno dopo 3 acquisti, indipendentemente dal ruolo',
  (await call('select _slot_ruolo_pieno($1,$2,$3) as p', [msid, msq[0].id, 'C'])).p === true)

// ------------------------------------------------------------- autorizzazioni --
console.log('\n== Autorizzazioni del banditore ==')
verifica('metti_all_asta con token sbagliato rifiutato',
  (await rpc('metti_all_asta', { ...inAsta, p_admin_token: 'x' })).motivo === 'non_autorizzato')
verifica('assegna con token sbagliato rifiutato',
  (await rpc('assegna', { p_sessione: sid, p_admin_token: 'x' })).motivo === 'non_autorizzato')
verifica('pubblica_assegnazione con token sbagliato rifiutata',
  (await rpc('pubblica_assegnazione', {
    p_sessione: sid, p_admin_token: 'x', p_squadra: A.id, p_giocatore_id: 999,
    p_nome: 'X', p_club: 'Y', p_ruolo: 'D', p_ruoli_mantra: null, p_prezzo: 1,
  })).motivo === 'non_autorizzato')
verifica('giocatore gia assegnato non puo tornare in asta',
  (await rpc('metti_all_asta', { ...inAsta, p_giocatore_id: 100 })).motivo === 'gia_assegnato')

// ------------------------------------------------- i due intervalli del conteggio --
console.log(`
== Durata della chiamata con intervalli distinti ==`)
await rpc('annulla_chiamata', { p_sessione: sid, p_admin_token: admin })
await rpc('metti_all_asta', { ...inAsta, p_giocatore_id: 900, p_nome: 'Cadenza', p_ruolo: 'C' })
const durata = await call(
  'select extract(epoch from (scadenza - now())) as s from chiamata where sessione_id=$1',
  [sid],
)
// attesa 5 + (1→2) 3 + (2→3) 4 = 12 secondi: al "tre" la chiamata e' chiusa
verifica('la scadenza coincide con il tre', Math.abs(Number(durata.s) - 12) < 1, String(durata.s))
await rpc('annulla_chiamata', { p_sessione: sid, p_admin_token: admin })

// ------------------------------------------- chiusura di una chiamata scaduta --
console.log(`
== Aggiudicazione di una chiamata scaduta, senza il banditore ==`)
await rpc('metti_all_asta', { ...inAsta, p_giocatore_id: 700, p_nome: 'Scaduto', p_ruolo: 'D' })
await rpc('rilancia', { p_sessione: sid, p_squadra: B.id, p_claim_token: tokB, p_offerta: 7 })
let sc = await rpc('aggiudica_se_scaduta', { p_sessione: sid })
verifica('prima della scadenza non aggiudica', sc.ok === false && sc.motivo === 'non_ancora_scaduta', JSON.stringify(sc))
await db.query("update chiamata set scadenza = now() - interval '1 second' where sessione_id=$1", [sid])
sc = await rpc('aggiudica_se_scaduta', { p_sessione: sid })
verifica('dopo la scadenza aggiudica senza token del banditore', sc.ok === true && sc.prezzo === 7, JSON.stringify(sc))
const ripetuta = await rpc('aggiudica_se_scaduta', { p_sessione: sid })
verifica('la seconda chiamata e innocua', ripetuta.ok === false && ripetuta.motivo === 'nessuna_chiamata')
const reg = await db.query('select * from assegnazione where sessione_id=$1 and giocatore_id=700', [sid])
verifica('acquisto registrato una sola volta', reg.rows.length === 1 && reg.rows[0].prezzo === 7)

// ------------------------------------------------ i segreti restano segreti --
console.log('\n== I token non sono leggibili dalle tabelle di gioco ==')
const colonne = async (tab) =>
  (await db.query('select column_name from information_schema.columns where table_name=$1', [tab]))
    .rows.map((r) => r.column_name)

const colSessione = await colonne('sessione')
const colSquadra = await colonne('squadra')
verifica('la tabella sessione non contiene admin_token', !colSessione.includes('admin_token'), colSessione.join(','))
verifica('la tabella squadra non contiene claim_token', !colSquadra.includes('claim_token'), colSquadra.join(','))
verifica('la tabella squadra espone solo il flag presa', colSquadra.includes('presa'))
verifica(
  'i token vivono in tabelle separate',
  (await colonne('sessione_segreto')).includes('admin_token') &&
    (await colonne('squadra_segreto')).includes('claim_token'),
)

// Una select completa su cio' che il client puo' leggere non deve contenere i
// token: e' esattamente il contenuto che finirebbe anche nelle notifiche realtime.
const rigaSessione = (await db.query('select * from sessione where id=$1', [sid])).rows[0]
const rigaSquadra = (await db.query('select * from squadra where id=$1', [A.id])).rows[0]
const valori = JSON.stringify(rigaSessione) + JSON.stringify(rigaSquadra)
verifica(
  'nessun token compare in una select * di sessione o squadra',
  !valori.includes(admin) && !valori.includes(tokA),
)

// --------------------------------------- rilancio all'ultimo istante --------
//
// Il guasto dell'asta del 2026: chi rilanciava un attimo prima del "tre" si
// portava via il giocatore senza che il conteggio ripartisse. La causa stava nel
// client, che chiamava `assegna` (il martello manuale, che non guarda
// l'orologio) invece di `aggiudica_se_scaduta`. Qui si fissa il contratto del
// server, cosi' se qualcuno ricollega il pulsante sbagliato il collaudo protesta.
console.log('\n== Rilancio nell\'ultimo istante ==')
await rpc('annulla_chiamata', { p_sessione: sid, p_admin_token: admin })
const messo = await rpc('metti_all_asta', { ...inAsta, p_giocatore_id: 900, p_nome: 'Leao', p_ruolo: 'D' })
verifica('giocatore messo in asta per la prova', messo.ok === true, JSON.stringify(messo))
await rpc('rilancia', { p_sessione: sid, p_squadra: B.id, p_claim_token: tokB, p_offerta: 100 })

// La chiamata sta per scadere: manca un soffio al martello
await db.query("update chiamata set scadenza = now() + interval '200 milliseconds' where sessione_id=$1", [sid])

r = await rpc('rilancia', { p_sessione: sid, p_squadra: A.id, p_claim_token: tokA, p_offerta: 150 })
verifica('rilancio a un soffio dalla scadenza accettato', r.ok === true, JSON.stringify(r))

let ch = (await db.query('select * from chiamata where sessione_id=$1', [sid])).rows[0]
const margine = new Date(ch.scadenza).getTime() - Date.now()
verifica('il conteggio riparte da capo: scadenza spostata avanti', margine > 5000, margine + 'ms')

const troppoPresto = await rpc('aggiudica_se_scaduta', { p_sessione: sid })
verifica(
  'aggiudica_se_scaduta rifiuta finche la nuova scadenza non e passata',
  troppoPresto.ok === false && troppoPresto.motivo === 'non_ancora_scaduta',
  JSON.stringify(troppoPresto),
)

ch = (await db.query('select * from chiamata where sessione_id=$1', [sid])).rows[0]
verifica(
  'la chiamata resta aperta sul nuovo miglior offerente',
  ch.stato === 'active' && ch.miglior_offerente_id === A.id,
)

// `assegna` invece aggiudica comunque: e' il martello del banditore, non un
// automatismo, e resta raggiungibile solo dal pulsante esplicito.
const manuale = await rpc('assegna', { p_sessione: sid, p_admin_token: admin })
verifica(
  'assegna resta il martello manuale e chiude anche prima della scadenza',
  manuale.ok === true && manuale.squadra_id === A.id,
)

// --------------------------------------- offerta legata alla versione -------
//
// "+5" vale solo sulla base che il dito ha letto: se il prezzo si muove nel
// frattempo, l'offerta calcolata non e' piu' quella voluta.
console.log('\n== Rilanci rapidi e versione della chiamata ==')
await rpc('metti_all_asta', { ...inAsta, p_giocatore_id: 901, p_nome: 'Lautaro', p_ruolo: 'D' })
await rpc('rilancia', { p_sessione: sid, p_squadra: B.id, p_claim_token: tokB, p_offerta: 100 })
ch = (await db.query('select * from chiamata where sessione_id=$1', [sid])).rows[0]
const versione = ch.versione

r = await rpc('rilancia', {
  p_sessione: sid, p_squadra: A.id, p_claim_token: tokA, p_offerta: 105,
  p_versione_attesa: versione - 1,
})
verifica(
  'rilancio rapido su una base ormai vecchia rifiutato',
  r.ok === false && r.motivo === 'base_cambiata' && r.offerta_attuale === 100,
  JSON.stringify(r),
)

ch = (await db.query('select * from chiamata where sessione_id=$1', [sid])).rows[0]
verifica('il rifiuto non tocca il prezzo', ch.offerta_attuale === 100 && ch.miglior_offerente_id === B.id)

r = await rpc('rilancia', {
  p_sessione: sid, p_squadra: A.id, p_claim_token: tokA, p_offerta: 105,
  p_versione_attesa: versione,
})
verifica('rilancio rapido sulla versione giusta accettato', r.ok === true && r.offerta === 105, JSON.stringify(r))

// L'offerta libera e' una cifra voluta: non dipende dalla base, e passa senza versione.
r = await rpc('rilancia', { p_sessione: sid, p_squadra: B.id, p_claim_token: tokB, p_offerta: 300 })
verifica('offerta libera senza versione accettata comunque', r.ok === true && r.offerta === 300, JSON.stringify(r))
await rpc('annulla_chiamata', { p_sessione: sid, p_admin_token: admin })

// --------------------------------------- impostazioni dei rilanci rapidi ----
console.log('\n== Rilanci rapidi: impostazioni ==')
const pre = (await db.query('select rilanci_rapidi, attesa_offerta_ms from sessione where id=$1', [sid])).rows[0]
verifica('scalini predefiniti 1/5/10', JSON.stringify(pre.rilanci_rapidi) === '[1,5,10]', JSON.stringify(pre.rilanci_rapidi))
verifica('blocco predefinito di 800ms', pre.attesa_offerta_ms === 800)

await rpc('aggiorna_impostazioni', {
  p_sessione: sid, p_admin_token: admin,
  p_rilancio_minimo: 1, p_attesa_secondi: 5, p_secondi_1_2: 3, p_secondi_2_3: 4,
  p_rilanci_rapidi: '{2,10,25}', p_attesa_offerta_ms: 1200,
})
const post = (await db.query('select rilanci_rapidi, attesa_offerta_ms from sessione where id=$1', [sid])).rows[0]
verifica('scalini aggiornabili dal banditore', JSON.stringify(post.rilanci_rapidi) === '[2,10,25]', JSON.stringify(post.rilanci_rapidi))
verifica('blocco aggiornabile dal banditore', post.attesa_offerta_ms === 1200)

console.log(`\n${passati} verifiche superate, ${falliti} fallite\n`)
process.exit(falliti === 0 ? 0 : 1)
