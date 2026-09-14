import { rosterCsv } from '../src/csvRose.ts'

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

console.log(`\n${ok} superate, ${ko} fallite\n`)
process.exit(ko === 0 ? 0 : 1)
