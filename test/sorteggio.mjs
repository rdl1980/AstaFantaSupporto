import { chiamabili, sorteggia } from '../src/sorteggio.ts'

let ok = 0
let ko = 0
const v = (d, c, x = '') => {
  c ? (ok++, console.log('  ok   ' + d)) : (ko++, console.log('  FAIL ' + d + (x ? ' → ' + x : '')))
}

const p = (id, r, ceduto = false) => ({
  id, name: 'G' + id, team: 'X', r, rm: [r], qtA: 1, qtI: 1, qtAM: 1, qtIM: 1, fvm: 1, fvmM: 1, ceduto,
})

const stato = {
  players: [p(1, 'P'), p(2, 'P'), p(3, 'D'), p(4, 'D'), p(5, 'C'), p(6, 'A'), p(7, 'A', true)],
  purchases: [{ playerId: 4, teamId: 't1', price: 10, ts: 1 }],
}

console.log('\n== Chi e ancora chiamabile ==')
const tutti = chiamabili(stato, { ambito: 'tutti' })
v('esclude i ceduti e i gia presi', tutti.map((x) => x.id).join(',') === '1,2,3,5,6', tutti.map((x) => x.id).join(','))
const soloP = chiamabili(stato, { ambito: 'ruolo', ruolo: 'P' })
v('per reparto: solo i portieri', soloP.map((x) => x.id).join(',') === '1,2')
const soloD = chiamabili(stato, { ambito: 'ruolo', ruolo: 'D' })
v('per reparto: il difensore gia preso non c e', soloD.map((x) => x.id).join(',') === '3')

console.log('\n== Sorteggio ==')
// caso() controllato: 0 pesca il primo, ~1 l ultimo
v('caso 0 pesca il primo del mazzo', sorteggia(stato, { ambito: 'tutti', caso: () => 0 }).player.id === 1)
v('caso quasi 1 pesca l ultimo', sorteggia(stato, { ambito: 'tutti', caso: () => 0.999 }).player.id === 6)
v('caso esattamente 1 non sfora il mazzo', sorteggia(stato, { ambito: 'tutti', caso: () => 1 }).player.id === 6)

const e1 = sorteggia(stato, { ambito: 'ruolo', ruolo: 'P', caso: () => 0 })
v('per reparto pesca dentro al reparto', e1.player.r === 'P' && e1.player.id === 1)
v('conta quanti restano nel mazzo dopo quello estratto', e1.rimasti === 1, String(e1.rimasti))

// Il numero utile mentre si pesca e' quanti non sono ancora usciti, non quanti
// sono liberi nel reparto: con uno gia' scartato il mazzo e' piu' corto.
const e1b = sorteggia(stato, { ambito: 'ruolo', ruolo: 'P', esclusi: new Set([1]), caso: () => 0 })
v('gli scartati accorciano il mazzo', e1b.rimasti === 0, String(e1b.rimasti))

console.log('\n== Scarti e rimescolamento ==')
const e2 = sorteggia(stato, { ambito: 'ruolo', ruolo: 'P', esclusi: new Set([1]), caso: () => 0 })
v('chi e gia uscito resta fuori dal mazzo', e2.player.id === 2 && e2.rimescolato === false)

// Mazzo esaurito dagli scarti: si riparte, non si risponde "finito"
const e3 = sorteggia(stato, { ambito: 'ruolo', ruolo: 'P', esclusi: new Set([1, 2]), caso: () => 0 })
v('mazzo finito: si rimescola invece di bloccarsi', e3.player !== null && e3.rimescolato === true, JSON.stringify(e3.player))

// Nessun chiamabile davvero: qui il nulla e la risposta giusta
const vuoto = sorteggia({ players: [p(9, 'A', true)], purchases: [] }, { ambito: 'tutti' })
v('senza chiamabili non estrae nulla', vuoto.player === null && vuoto.rimescolato === false)

const tuttiPresi = sorteggia(
  { players: [p(1, 'P')], purchases: [{ playerId: 1, teamId: 't', price: 1, ts: 1 }] },
  { ambito: 'tutti' },
)
v('un giocatore gia assegnato non torna nel mazzo', tuttiPresi.player === null)

console.log('\n== Distribuzione ==')
// Non si verifica la casualita', si verifica che il mazzo sia raggiungibile
// tutto: un errore di indice lascerebbe fuori il primo o l ultimo.
const usciti = new Set()
for (let i = 0; i < 2000; i++) usciti.add(sorteggia(stato, { ambito: 'tutti' }).player.id)
v('con 2000 estrazioni escono tutti e 5 i chiamabili', usciti.size === 5, [...usciti].sort().join(','))

console.log(`\n${ok} superate, ${ko} fallite\n`)
process.exit(ko === 0 ? 0 : 1)
