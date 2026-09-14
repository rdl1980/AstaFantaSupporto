import { CAMPIONE_MINIMO, etichettaInflazione, inflazione, ritara } from '../src/inflazione.ts'

let ok = 0
let ko = 0
const v = (d, c, x = '') => {
  c ? (ok++, console.log('  ok   ' + d)) : (ko++, console.log('  FAIL ' + d + (x ? ' → ' + x : '')))
}

const p = (id, r) => ({
  id, name: 'G' + id, team: 'X', r, rm: [r], qtA: 1, qtI: 1, qtAM: 1, qtIM: 1, fvm: 1, fvmM: 1, ceduto: false,
})

/** n acquisti di un reparto, ognuno pagato `pagato` dove il suggerito diceva `sugg` */
function scenario(voci) {
  const players = []
  const purchases = []
  const sugg = new Map()
  let id = 1
  for (const { r, pagato, suggerito, quanti = 1 } of voci) {
    for (let i = 0; i < quanti; i++) {
      players.push(p(id, r))
      purchases.push({ playerId: id, teamId: 't1', price: pagato, ts: id })
      sugg.set(id, suggerito)
      id++
    }
  }
  return { state: { players, purchases }, sugg }
}

console.log('\n== Campione troppo magro ==')
const magro = scenario([{ r: 'A', pagato: 200, suggerito: 100, quanti: 3 }])
const im = inflazione(magro.state, magro.sugg)
v('sotto la soglia non si azzarda un numero', im.scostamento === null, String(im.scostamento))
v('ma il campione si conta lo stesso', im.campione === 3)
v(`la soglia e ${CAMPIONE_MINIMO}`, CAMPIONE_MINIMO === 8)

console.log('\n== Scostamento ==')
const su = scenario([{ r: 'C', pagato: 118, suggerito: 100, quanti: 10 }])
const isu = inflazione(su.state, su.sugg)
v('si paga il 18% sopra', Math.abs(isu.scostamento - 0.18) < 1e-9, String(isu.scostamento))
v('totali coerenti', isu.pagato === 1180 && isu.atteso === 1000)

const giu = scenario([{ r: 'C', pagato: 80, suggerito: 100, quanti: 10 }])
v('si paga sotto: scostamento negativo', Math.abs(inflazione(giu.state, giu.sugg).scostamento + 0.2) < 1e-9)

console.log('\n== Si pesa sui crediti, non sulle percentuali ==')
// Un portiere da 1 pagato 3 e' +200% ma sposta il mercato di due crediti: sulla
// media delle percentuali dominerebbe, sul rapporto fra totali quasi non si vede.
const misto = scenario([
  { r: 'P', pagato: 3, suggerito: 1, quanti: 4 },
  { r: 'A', pagato: 100, suggerito: 100, quanti: 6 },
])
const imisto = inflazione(misto.state, misto.sugg)
v(
  'il portiere da 1 credito non ribalta il quadro',
  imisto.scostamento < 0.03,
  `${imisto.scostamento} (pagato ${imisto.pagato}, atteso ${imisto.atteso})`,
)

console.log('\n== Per reparto ==')
const perReparto = scenario([
  { r: 'A', pagato: 150, suggerito: 100, quanti: 8 },
  { r: 'D', pagato: 70, suggerito: 100, quanti: 8 },
])
const ipr = inflazione(perReparto.state, perReparto.sugg)
v('attaccanti sopra', Math.abs(ipr.perReparto.A.scostamento - 0.5) < 1e-9, String(ipr.perReparto.A.scostamento))
v('difensori sotto', Math.abs(ipr.perReparto.D.scostamento + 0.3) < 1e-9, String(ipr.perReparto.D.scostamento))
v('un reparto senza acquisti non inventa nulla', ipr.perReparto.C.scostamento === null && ipr.perReparto.C.campione === 0)

console.log('\n== Acquisti senza suggerito ==')
const senza = scenario([{ r: 'A', pagato: 50, suggerito: 100, quanti: 8 }])
senza.sugg.delete(1)
const isz = inflazione(senza.state, senza.sugg)
v('chi non ha un suggerito resta fuori dal conto', isz.campione === 7 && isz.atteso === 700, JSON.stringify(isz))

console.log('\n== Ritaratura del suggerito ==')
v('usa lo scostamento del reparto quando c e', ritara(100, ipr, 'A') === 150, String(ritara(100, ipr, 'A')))
v('e quello del reparto anche in ribasso', ritara(100, ipr, 'D') === 70)
// C non ha campione: si ripiega sul generale, qui (150*8+70*8)/(100*16) = +10%
v('senza dati di reparto ripiega sul generale', ritara(100, ipr, 'C') === 110, String(ritara(100, ipr, 'C')))
v('senza nessun dato lascia il suggerito com e', ritara(100, im, 'A') === 100)
// Con un'asta molto sgonfia l'arrotondamento porterebbe a zero: un giocatore
// costa almeno un credito, quindi il suggerito ritarato non puo' sparire.
const crollo = scenario([{ r: 'C', pagato: 10, suggerito: 100, quanti: 10 }])
const icrollo = inflazione(crollo.state, crollo.sugg)
v('non scende mai sotto 1 credito', ritara(1, icrollo, 'C') === 1, String(ritara(1, icrollo, 'C')))
v('e per il resto arrotonda', ritara(200, icrollo, 'C') === 20, String(ritara(200, icrollo, 'C')))

console.log('\n== Etichetta ==')
v('sopra', etichettaInflazione(0.18) === '+18%')
v('sotto, con il meno tipografico', etichettaInflazione(-0.07) === '−7%')
v('in pari senza segno', etichettaInflazione(0) === '0%')
v('sconosciuto', etichettaInflazione(null) === '—')

console.log(`\n${ok} superate, ${ko} fallite\n`)
process.exit(ko === 0 ? 0 : 1)
