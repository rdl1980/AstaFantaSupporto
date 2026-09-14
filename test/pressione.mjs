import { chiHaFameDi, pressione } from '../src/pressione.ts'

let ok = 0
let ko = 0
const v = (d, c, x = '') => {
  c ? (ok++, console.log('  ok   ' + d)) : (ko++, console.log('  FAIL ' + d + (x ? ' → ' + x : '')))
}

const teams = [
  { id: 'io', name: 'Real Sconcerto', isMine: true },
  { id: 'a', name: 'Gennaro', isMine: false },
  { id: 'b', name: 'Gaetano', isMine: false },
]

const classic = {
  config: {
    mode: 'classic', budget: 4000, teams,
    classicSlots: { P: 3, D: 4, C: 4, A: 3 },
    mantraGk: 6, mantraOutfield: 29,
  },
  players: [], purchases: [],
}

/** Conti di una squadra, nella forma che lo store restituisce */
const stati = (remaining, slotsLeft, counts, maxBid = remaining) => ({
  remaining, slotsLeft, maxBid,
  classicCounts: counts,
  gkCount: counts.P,
  outfieldCount: counts.D + counts.C + counts.A,
})

console.log('\n== Crediti per slot ==')
const mappa = {
  // rosa quasi completa, tanti crediti: puo' stare fermo
  io: stati(900, 1, { P: 3, D: 4, C: 4, A: 2 }),
  // stessi crediti ma sei buchi: deve spenderli
  a: stati(900, 6, { P: 1, D: 3, C: 2, A: 2 }),
  b: stati(120, 4, { P: 2, D: 3, C: 4, A: 1 }),
}
const righe = pressione(classic, (id) => mappa[id])

v('una riga per squadra', righe.length === 3)
v('ordinate dal piu capace di spingere', righe.map((r) => r.teamId).join(',') === 'io,a,b', righe.map((r) => r.teamId).join(','))
v('900 crediti su 1 slot = 900 per slot', righe.find((r) => r.teamId === 'io').perSlot === 900)
v('900 crediti su 6 slot = 150 per slot', righe.find((r) => r.teamId === 'a').perSlot === 150)
v('arrotonda per difetto: 120 su 4 = 30', righe.find((r) => r.teamId === 'b').perSlot === 30)

console.log('\n== Rosa completa ==')
const completa = pressione(classic, () => stati(700, 0, { P: 3, D: 4, C: 4, A: 3 }))
v('nessuno slot: per slot vale zero, non infinito', completa.every((r) => r.perSlot === 0))
v('e non risulta nessun reparto mancante', completa.every((r) => r.mancanti.length === 0))

console.log('\n== Reparti scoperti ==')
const rigaA = righe.find((r) => r.teamId === 'a')
v(
  'elenca solo i reparti ancora scoperti, con quanti ne mancano',
  JSON.stringify(rigaA.mancanti.map((m) => `${m.chiave}${m.quanti}`)) === '["P2","D1","C2","A1"]',
  JSON.stringify(rigaA.mancanti),
)
const rigaB = righe.find((r) => r.teamId === 'b')
v('un reparto gia pieno non compare', !rigaB.mancanti.some((m) => m.chiave === 'C'), JSON.stringify(rigaB.mancanti))

console.log('\n== Chi ha fame di un ruolo ==')
const fameP = chiHaFameDi(righe, 'P', false)
v('solo chi quel reparto lo deve ancora coprire', fameP.map((r) => r.teamId).join(',') === 'a,b', fameP.map((r) => r.teamId).join(','))
const fameC = chiHaFameDi(righe, 'C', false)
v('chi lo ha completo resta fuori', fameC.map((r) => r.teamId).join(',') === 'a')
v('la propria squadra non e mai un avversario', chiHaFameDi(righe, 'A', false).every((r) => !r.mia))

console.log('\n== Mantra: portieri e movimento ==')
const mantra = {
  config: { ...classic.config, mode: 'mantra', mantraGk: 3, mantraOutfield: 8 },
  players: [], purchases: [],
}
const rmantra = pressione(mantra, () => stati(500, 5, { P: 2, D: 1, C: 2, A: 1 }))
v(
  'i reparti sono due, non quattro',
  JSON.stringify(rmantra[0].mancanti.map((m) => `${m.chiave}${m.quanti}`)) === '["P1","MOV4"]',
  JSON.stringify(rmantra[0].mancanti),
)
// In Mantra un difensore e un attaccante pescano dallo stesso mucchio: chi ha
// fame di movimento ha fame di entrambi.
v('un ruolo di movimento interroga la casella movimento', chiHaFameDi(rmantra, 'A', true).length === 2)
v('il portiere resta una casella a parte', chiHaFameDi(rmantra, 'P', true).length === 2)

const soloMov = pressione(mantra, () => stati(500, 4, { P: 3, D: 1, C: 2, A: 1 }))
v('con i portieri completi nessuno ne ha fame', chiHaFameDi(soloMov, 'P', true).length === 0)
v('ma il movimento resta scoperto', chiHaFameDi(soloMov, 'C', true).length === 2)

console.log(`\n${ok} superate, ${ko} fallite\n`)
process.exit(ko === 0 ? 0 : 1)
