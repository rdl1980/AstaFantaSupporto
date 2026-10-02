import { abbinaRose, fondiAcquisti, leggiRoseCsv, rosterCsv } from '../src/csvRose.ts'

let ok = 0
let ko = 0
const v = (d, c, x = '') => {
  c ? (ok++, console.log('  ok   ' + d)) : (ko++, console.log('  FAIL ' + d + (x ? ' → ' + x : '')))
}

const p = (id, r) => ({
  id, name: 'G' + id, team: 'X', r, rm: [r], qtA: 1, qtI: 1, qtAM: 1, qtIM: 1, fvm: 1, fvmM: 1, ceduto: false,
})

const stato = {
  players: [p(5694, 'P'), p(7554, 'P'), p(6752, 'D'), p(5585, 'A'), p(6215, 'C')],
  purchases: [
    { playerId: 6215, teamId: 't1', price: 20, ts: 3 },
    { playerId: 5585, teamId: 't1', price: 2007, ts: 4 },
    { playerId: 5694, teamId: 't1', price: 250, ts: 1 },
    { playerId: 6752, teamId: 't1', price: 248, ts: 2 },
    { playerId: 7554, teamId: 't2', price: 50, ts: 5 },
  ],
  config: {
    teams: [
      { id: 't1', name: 'Rosario', isMine: true },
      { id: 't2', name: 'Gennaro', isMine: false },
      { id: 't3', name: 'Senza acquisti', isMine: false },
    ],
  },
}

const csv = rosterCsv(stato)

console.log('\n== Forma del file, come nell export vero di fantacalcio.it ==')
v('comincia con il separatore, non con un intestazione', csv.startsWith('$,$,$\n'), JSON.stringify(csv.slice(0, 12)))
v('finisce con un a capo', csv.endsWith('\n') && !csv.endsWith('\n\n'), JSON.stringify(csv.slice(-14)))
v('nessun ritorno a carrello', !csv.includes('\r'))
v('nessun BOM in testa', csv.charCodeAt(0) !== 0xfeff)
v('non finisce con un separatore penzolante', !csv.trimEnd().endsWith('$,$,$'))

const righe = csv.split('\n').filter(Boolean)
v('tre campi per riga, sempre', righe.every((r) => r.split(',').length === 3), righe.find((r) => r.split(',').length !== 3))

console.log('\n== Blocchi e contenuto ==')
v('un separatore per squadra con acquisti', righe.filter((r) => r === '$,$,$').length === 2)
v('la squadra senza acquisti non ha un blocco vuoto', !csv.includes('Senza acquisti'))
v('quattro righe per Rosario', righe.filter((r) => r.startsWith('Rosario,')).length === 4)
v('una riga per Gennaro', righe.filter((r) => r.startsWith('Gennaro,')).length === 1)

// P, D, C, A e dentro il reparto dal piu' caro: e' l ordine con cui si legge una rosa
const rosario = righe.filter((r) => r.startsWith('Rosario,'))
v(
  'ordinati per reparto e poi per prezzo',
  rosario.join('|') === 'Rosario,5694,250|Rosario,6752,248|Rosario,6215,20|Rosario,5585,2007',
  rosario.join('|'),
)

console.log('\n== Casi storti ==')
const conVirgola = rosterCsv({
  ...stato,
  config: { teams: [{ id: 't1', name: 'Real, Sconcerto', isMine: true }] },
  purchases: [{ playerId: 5694, teamId: 't1', price: 7, ts: 1 }],
})
v('la virgola nel nome squadra non spezza la riga', conVirgola.includes('Real Sconcerto,5694,7'), JSON.stringify(conVirgola))
v('anche col nome storto restano tre campi', conVirgola.split('\n').filter(Boolean).every((r) => r.split(',').length === 3))

const fuoriListone = rosterCsv({
  ...stato,
  purchases: [{ playerId: 99999, teamId: 't1', price: 5, ts: 1 }],
})
v('un acquisto senza giocatore nel listone viene saltato', fuoriListone === '', JSON.stringify(fuoriListone))

v('senza acquisti il file e vuoto, non un separatore solo', rosterCsv({ ...stato, purchases: [] }) === '')

console.log('\n== Lettura: lo stesso file, al contrario ==')
const letto = leggiRoseCsv(csv)
v('ritrova tutte le righe scritte', letto.righe.length === 5, String(letto.righe.length))
v('ritrova le due squadre con acquisti', letto.nomiSquadra.join('|') === 'Rosario|Gennaro', letto.nomiSquadra.join('|'))
v('i separatori non sono righe ignorate', letto.ignorate === 0, String(letto.ignorate))

const andataRitorno = abbinaRose(letto, stato)
v('ogni acquisto torna alla sua squadra e al suo prezzo',
  JSON.stringify([...andataRitorno.acquisti].sort((a, b) => a.playerId - b.playerId)) ===
    JSON.stringify([...stato.purchases].map(({ playerId, teamId, price }) => ({ playerId, teamId, price })).sort((a, b) => a.playerId - b.playerId)),
  JSON.stringify(andataRitorno.acquisti))
v('niente da segnalare su un file scritto da qui',
  andataRitorno.squadreIgnote.length === 0 && andataRitorno.fuoriListone.length === 0 && andataRitorno.doppioni.length === 0)

console.log('\n== File che arrivano da altrove ==')
const sporco = leggiRoseCsv('\ufeffsquadra,idGiocatore,prezzo\r\n$,$,$\r\nRosario,5694,250\r\n\r\n   \r\nRosario,6752,  248 \r\n')
v('BOM, CRLF e righe vuote non fanno danni', sporco.righe.length === 2, JSON.stringify(sporco.righe))
v('l intestazione di un foglio di calcolo viene contata fra le ignorate', sporco.ignorate === 1, String(sporco.ignorate))
v('gli spazi intorno ai campi si tolgono', sporco.righe[1].prezzo === 248 && sporco.righe[1].giocatoreId === 6752, JSON.stringify(sporco.righe[1]))

const prezziStorti = leggiRoseCsv('A,5694,0\nA,6752,-3\nA,6215,2.6\n')
v('un prezzo a zero o negativo diventa 1', prezziStorti.righe.slice(0, 2).every((r) => r.prezzo === 1), JSON.stringify(prezziStorti.righe))
v('un prezzo con la virgola si arrotonda', prezziStorti.righe[2].prezzo === 3, String(prezziStorti.righe[2].prezzo))

console.log('\n== Abbinamento delle squadre ==')
const altraLega = leggiRoseCsv('$,$,$\nReal Sconcerto,5694,250\nIgnoti FC,6752,100\n')
const statoVirgola = { ...stato, config: { teams: [{ id: 't1', name: 'Real, Sconcerto', isMine: true }, { id: 't2', name: 'Gennaro', isMine: false }] } }
const perNome = abbinaRose(altraLega, statoVirgola)
v('la squadra si riconosce anche se la virgola del nome era stata tolta', perNome.mappa['Real Sconcerto'] === 't1', JSON.stringify(perNome.mappa))
v('un nome che non esiste resta da assegnare', perNome.squadreIgnote.join() === 'Ignoti FC', JSON.stringify(perNome.squadreIgnote))
v('e la sua riga non entra fra gli acquisti', perNome.acquisti.length === 1 && perNome.acquisti[0].playerId === 5694)

const conScelta = abbinaRose(altraLega, statoVirgola, { 'Ignoti FC': 't2' })
v('la scelta a mano porta il blocco sulla squadra indicata',
  conScelta.acquisti.some((a) => a.playerId === 6752 && a.teamId === 't2'), JSON.stringify(conScelta.acquisti))
v('e non resta piu niente da assegnare', conScelta.squadreIgnote.length === 0)
v('una scelta vuota lascia il blocco fuori di proposito',
  abbinaRose(altraLega, statoVirgola, { 'Ignoti FC': '' }).acquisti.length === 1)
v('una squadra inventata nella scelta non passa',
  abbinaRose(altraLega, statoVirgola, { 'Ignoti FC': 't99' }).acquisti.length === 1)

console.log('\n== Righe che non si possono usare ==')
const strane = abbinaRose(leggiRoseCsv('Rosario,99999,10\nRosario,5694,250\nGennaro,5694,999\n'), stato)
v('un id che non sta nel listone viene segnalato', strane.fuoriListone.join() === '99999', JSON.stringify(strane.fuoriListone))
v('un giocatore in due rose viene segnalato', strane.doppioni.join() === '5694', JSON.stringify(strane.doppioni))
v('e vale la prima riga, non l ultima',
  strane.acquisti.length === 1 && strane.acquisti[0].teamId === 't1' && strane.acquisti[0].price === 250,
  JSON.stringify(strane.acquisti))

const conCeduto = abbinaRose(leggiRoseCsv('Rosario,5694,250\n'), {
  ...stato,
  players: stato.players.map((p) => (p.id === 5694 ? { ...p, ceduto: true } : p)),
})
v('chi e nel foglio Ceduti entra in rosa ma si fa notare', conCeduto.acquisti.length === 1 && conCeduto.ceduti === 1)

console.log('\n== Come le rose lette si uniscono a quelle registrate ==')
const giaInRosa = [
  { playerId: 5694, teamId: 't1', price: 250, ts: 1000 },
  { playerId: 6215, teamId: 't2', price: 20, ts: 2000 },
]
const dalFile = [
  { playerId: 5694, teamId: 't2', price: 300, ts: 9000 },
  { playerId: 6752, teamId: 't1', price: 7, ts: 9001 },
]

const sostituite = fondiAcquisti(giaInRosa, dalFile, true)
v('sostituendo resta solo cio che c era nel file', JSON.stringify(sostituite) === JSON.stringify(dalFile), JSON.stringify(sostituite))

const unite = fondiAcquisti(giaInRosa, dalFile, false)
v('aggiungendo non si perde chi non era nel file', unite.some((a) => a.playerId === 6215 && a.price === 20))
v('chi c era gia cambia squadra e prezzo', unite.some((a) => a.playerId === 5694 && a.teamId === 't2' && a.price === 300))
v('ma conserva l orario della chiamata vera', unite.find((a) => a.playerId === 5694).ts === 1000, String(unite.find((a) => a.playerId === 5694).ts))
v('chi arriva dal file tiene il suo orario', unite.find((a) => a.playerId === 6752).ts === 9001)
v('nessun doppione dopo l unione', new Set(unite.map((a) => a.playerId)).size === unite.length)

console.log(`\n${ok} superate, ${ko} fallite\n`)
process.exit(ko === 0 ? 0 : 1)
