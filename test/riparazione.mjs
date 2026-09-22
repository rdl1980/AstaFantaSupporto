import {
  budgetTotale,
  confrontaListoni,
  creaSvincolo,
  perditeSvincoli,
  problemiRosa,
  rendimentoRosa,
  rimborsoDi,
  sostituti,
} from '../src/riparazione.ts'

let ok = 0
let ko = 0
const v = (d, c, x = '') => {
  c ? (ok++, console.log('  ok   ' + d)) : (ko++, console.log('  FAIL ' + d + (x ? ' → ' + x : '')))
}

const g = (id, r, qtA, team = 'Inter', name = 'G' + id) => ({
  id, name, team, r, rm: [r], qtA, qtI: qtA, qtAM: qtA, qtIM: qtA, fvm: qtA * 10, fvmM: qtA * 10, ceduto: false,
})

const rip = (patch = {}) => ({ aperta: true, budgetExtra: 0, rimborso: 'prezzo', rimborsoPercento: 50, ...patch })

const stato = (patch = {}) => ({
  config: {
    mode: 'classic', budget: 4000, classicSlots: { P: 2, D: 2, C: 2, A: 2 },
    mantraGk: 3, mantraOutfield: 5,
    teams: [{ id: 'io', name: 'Mia', isMine: true }, { id: 'a', name: 'Altra', isMine: false }],
  },
  players: [], purchases: [], svincoli: [], riparazione: rip(), ...patch,
})

console.log('\n== Quanti crediti torna uno svincolo ==')
const tizio = g(1, 'A', 20)
v('a prezzo pieno torna quello che avevi pagato', rimborsoDi(rip(), 200, tizio, 'classic') === 200)
v('a percentuale si arrotonda', rimborsoDi(rip({ rimborso: 'percentuale', rimborsoPercento: 40 }), 205, tizio, 'classic') === 82, String(rimborsoDi(rip({ rimborso: 'percentuale', rimborsoPercento: 40 }), 205, tizio, 'classic')))
v('a quotazione torna la quotazione di oggi', rimborsoDi(rip({ rimborso: 'quotazione' }), 200, tizio, 'classic') === 20)
v('in Mantra si usa la quotazione Mantra', rimborsoDi(rip({ rimborso: 'quotazione' }), 200, { ...tizio, qtAM: 33 }, 'mantra') === 33)
// Un giocatore sparito dal listone non ha una quotazione: azzerare il rimborso
// significherebbe farti pagare una cessione che non hai deciso tu.
v('senza giocatore nel listone non si azzera', rimborsoDi(rip({ rimborso: 'quotazione' }), 200, undefined, 'classic') === 200)

console.log('\n== Lo svincolo conserva la cronologia ==')
const s1 = stato({ players: [tizio], purchases: [{ playerId: 1, teamId: 'io', price: 200, ts: 111 }] })
const sv = creaSvincolo(s1, s1.purchases[0], tizio, false)
v('tiene il ts dell acquisto originale', sv.ts === 111)
v('e segna quando e uscito', sv.svincolatoIl > 0 && sv.svincolatoIl !== 111)
v('copia nome, club e ruolo', sv.nome === 'G1' && sv.club === 'Inter' && sv.ruolo === 'A')

// Copiarli serve proprio qui: uno svincolo forzato avviene quando il giocatore
// non e' piu' nel listone, e cercarlo dopo non darebbe niente.
const forzato = creaSvincolo(s1, s1.purchases[0], undefined, true)
v('lo svincolo forzato resta riconoscibile', forzato.forzato === true)
v('e rimborsa comunque il prezzo pagato', forzato.rimborso === 200)
const scelto = creaSvincolo({ ...s1, riparazione: rip({ rimborso: 'quotazione' }) }, s1.purchases[0], tizio, false)
v('quello scelto segue la regola della lega', scelto.forzato === false && scelto.rimborso === 20)
v('un rimborso indicato a mano vince sulla regola', creaSvincolo(s1, s1.purchases[0], tizio, false, 77).rimborso === 77)

console.log('\n== Crediti ==')
v('a finestra chiusa il budget extra non conta', budgetTotale(stato({ riparazione: rip({ aperta: false, budgetExtra: 500 }) })) === 4000)
v('aperta, si somma', budgetTotale(stato({ riparazione: rip({ budgetExtra: 500 }) })) === 4500)
const svincoli = [
  { teamId: 'io', price: 200, rimborso: 200 },
  { teamId: 'io', price: 300, rimborso: 100 },
  { teamId: 'a', price: 900, rimborso: 0 },
]
v('a rimborso pieno non si perde nulla', perditeSvincoli([svincoli[0]], 'io') === 0)
v('si perde solo la differenza', perditeSvincoli(svincoli, 'io') === 200, String(perditeSvincoli(svincoli, 'io')))
v('le perdite di un altro non ti riguardano', perditeSvincoli(svincoli, 'a') === 900)

console.log('\n== Diff fra due listoni ==')
const prima = [g(1, 'A', 20, 'Inter', 'Rimane'), g(2, 'D', 10, 'Roma', 'Traslocato'), g(3, 'C', 15, 'Lazio', 'Partito')]
const dopo = [g(1, 'A', 22, 'Inter', 'Rimane'), g(2, 'D', 11, 'Milan', 'Traslocato'), g(9, 'A', 30, 'Napoli', 'Arrivato')]
const d = confrontaListoni(prima, dopo, [{ playerId: 3, teamId: 'io', price: 150, ts: 1 }], 'gennaio.xlsx')
v('conta gli arrivi', d.nuovi === 1)
v('vede chi ha cambiato squadra', d.cambioSquadra.length === 1 && d.cambioSquadra[0].da === 'Roma' && d.cambioSquadra[0].a === 'Milan', JSON.stringify(d.cambioSquadra))
v('un cambio di sola quotazione non e un trasloco', !d.cambioSquadra.some((c) => c.id === 1))
v('elenca chi e uscito dalla Serie A', d.usciti.length === 1 && d.usciti[0].nome === 'Partito')
v('e segnala quanti di quelli erano in una rosa', d.svincoliForzati === 1)
v('tiene il nome del file', d.fileName === 'gennaio.xlsx')

console.log('\n== Rendimento della rosa ==')
// Il cambio si misura su tutta la lega: 600 crediti spesi per 60 punti di
// quotazione fanno 10 crediti a punto.
const listone = [g(1, 'A', 30), g(2, 'C', 20), g(3, 'D', 10), g(4, 'P', 30)]
const rosa = stato({
  players: listone,
  purchases: [
    { playerId: 1, teamId: 'io', price: 300, ts: 1 }, // 30 punti a 10: in linea
    { playerId: 2, teamId: 'io', price: 250, ts: 2 }, // 20 punti pagati 250: caro
    { playerId: 3, teamId: 'a', price: 50, ts: 3 },
  ],
})
const rend = rendimentoRosa(rosa, 'io')
v('una riga per giocatore della rosa, non della lega', rend.length === 2)
v('il peggiore viene per primo', rend[0].playerId === 2)
v('valore di oggi al cambio della lega', rend[0].valoreOggi === 200, JSON.stringify(rend[0]))
v('e lo scarto e quanto ci stai rimettendo', rend[0].scarto === 50)
v('chi e in linea col mercato ha scarto zero', rend[1].scarto === 0, JSON.stringify(rend[1]))

// Un giocatore uscito dal listone non ha quotazione: vale zero, e si vede.
const conFantasma = stato({
  players: listone,
  purchases: [...rosa.purchases, { playerId: 99, teamId: 'io', price: 250, ts: 4 }],
})
const rf = rendimentoRosa(conFantasma, 'io').find((r) => r.playerId === 99)
v('chi non e piu nel listone vale zero', rf.quotazione === 0 && rf.valoreOggi === 0)
v('e resta nominabile anche se sparito', rf.nome.includes('99'))
v('senza quotazioni in giro non si divide per zero', rendimentoRosa(stato({ purchases: [{ playerId: 5, teamId: 'io', price: 9, ts: 1 }] }), 'io')[0].valoreOggi === 0)

console.log('\n== Chi prendere al posto di chi ==')
const mercato = stato({
  players: [...listone, g(5, 'C', 40, 'Napoli', 'Forte'), g(6, 'C', 25, 'Como', 'Medio'), g(7, 'C', 15, 'Lecce', 'Scarso')],
  purchases: rosa.purchases,
})
// Cambio 10 crediti a punto: Forte costa ~400, Medio ~250.
const alt = sostituti(mercato, 'io', 2, 300)
// Anche chi e' piu' scarso resta in lista: dopo uno svincolo forzato quello slot
// va riempito comunque, e "non c'e' nessuno meglio di lui" non e' una risposta.
v('elenca tutti i liberi del reparto', alt.length === 3, JSON.stringify(alt.map((x) => x.player.name)))
v('il segno dice se e un passo avanti o indietro', alt.find((x) => x.player.name === 'Scarso').miglioramento === -5, JSON.stringify(alt.map((x) => `${x.player.name}:${x.miglioramento}`)))
v('e solo dello stesso reparto', alt.every((x) => x.player.r === 'C'))
v('chi e gia in una rosa non si propone', !alt.some((x) => x.player.id === 3))
v('stima il costo al cambio della lega', alt.find((x) => x.player.id === 6).costoStimato === 250, JSON.stringify(alt.find((x) => x.player.id === 6)))
// Con 300 crediti Medio si prende, Forte no: prima quelli che puoi permetterti.
v('in cima chi ti puoi permettere', alt[0].player.id === 6 && alt[0].allaPortata === true, JSON.stringify(alt[0]))
v('e chi e fuori portata resta in lista, segnato', alt.some((x) => x.player.id === 5 && !x.allaPortata))
v('con piu crediti cambia la cima', sostituti(mercato, 'io', 2, 500)[0].player.id === 5)

console.log('\n== Rosa valida ==')
// Slot 1/2/2/2: con un portiere solo quel reparto e' a posto, il resto no.
const config1P = { ...stato().config, classicSlots: { P: 1, D: 2, C: 2, A: 2 } }
const incompleta = stato({
  config: config1P,
  players: listone,
  purchases: [{ playerId: 1, teamId: 'io', price: 10, ts: 1 }, { playerId: 4, teamId: 'io', price: 10, ts: 2 }],
})
const pr = problemiRosa(incompleta, 'io')
v('segnala i reparti scoperti', pr.some((x) => x.chiave === 'D' && x.scostamento === 2), JSON.stringify(pr))
v('un reparto a posto non compare', !pr.some((x) => x.chiave === 'P'), JSON.stringify(pr))

// Durante la riparazione si svincola prima e si compra dopo, quindi si puo'
// anche sforare: tre centrocampisti su due slot.
const troppi = problemiRosa(stato({
  config: config1P,
  players: [...listone, g(5, 'C', 40), g(6, 'C', 25)],
  purchases: [
    { playerId: 2, teamId: 'io', price: 1, ts: 1 },
    { playerId: 5, teamId: 'io', price: 1, ts: 2 },
    { playerId: 6, teamId: 'io', price: 1, ts: 3 },
  ],
}), 'io')
v('e segnala anche chi ne ha troppi, col segno opposto', troppi.some((x) => x.chiave === 'C' && x.scostamento === -1), JSON.stringify(troppi))

// Un giocatore fuori dal listone occupa uno slot ma non giochera' mai
const conSparito = stato({ players: listone, purchases: [{ playerId: 99, teamId: 'io', price: 1, ts: 1 }] })
v('chi non e piu nel listone e un problema a se', problemiRosa(conSparito, 'io').some((x) => x.chiave === 'FUORI' && x.scostamento === 1))

console.log('\n== Mantra: portieri e movimento ==')
const mantra = stato({
  config: { ...stato().config, mode: 'mantra', mantraGk: 2, mantraOutfield: 3 },
  players: listone,
  purchases: [{ playerId: 4, teamId: 'io', price: 1, ts: 1 }, { playerId: 1, teamId: 'io', price: 1, ts: 2 }],
})
const pm = problemiRosa(mantra, 'io')
v('i reparti sono due', pm.length === 2 && pm.map((x) => x.chiave).join(',') === 'P,MOV', JSON.stringify(pm))
v('manca un portiere e due di movimento', pm[0].scostamento === 1 && pm[1].scostamento === 2)

console.log(`\n${ok} superate, ${ko} fallite\n`)
process.exit(ko === 0 ? 0 : 1)
