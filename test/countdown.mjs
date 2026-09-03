import { conteggio, etichetta, durataTotale } from '../src/live/countdown.ts'

let ok = 0
let ko = 0
const v = (d, c, x = '') => {
  c ? (ok++, console.log('  ok   ' + d)) : (ko++, console.log('  FAIL ' + d + (x ? ' → ' + x : '')))
}

// attesa 5s, 1→2 in 3s, 2→3 in 4s  →  al "tre" la chiamata chiude: 5 + 3 + 4 = 12s
const cfg = { attesaSecondi: 5, secondiDa1A2: 3, secondiDa2A3: 4 }
v('durata = attesa + (1→2) + (2→3)', durataTotale(cfg) === 12, String(durataTotale(cfg)))
const S = 100000
const f = (sec) => conteggio(S, S - sec * 1000, cfg) // sec = secondi rimanenti

v('12s rimanenti: attesa, 5s al conteggio', f(12).fase === 'attesa' && Math.abs(f(12).alConteggio - 5) < 1e-9, JSON.stringify(f(12)))
v('7.1s rimanenti: ancora attesa (soglia non toccata)', f(7.1).fase === 'attesa')
v('6.9s rimanenti: parte UNO', f(6.9).fase === 'conteggio' && f(6.9).numero === 1, JSON.stringify(f(6.9)))
v('5s rimanenti: UNO', f(5).numero === 1)
v('4.1s rimanenti: UNO (dura 3s)', f(4.1).numero === 1)
v('3.9s rimanenti: DUE', f(3.9).numero === 2, JSON.stringify(f(3.9)))
v('1s rimanenti: DUE', f(1).numero === 2)
v('0.1s rimanenti: ancora DUE', f(0.1).numero === 2)

// il "tre" e' la chiusura: non e' una fase di conteggio ma la scadenza
v('0s: scaduta, cioe il TRE', f(0).fase === 'scaduta')
v('oltre la scadenza: resta scaduta', f(-5).fase === 'scaduta')
v('nessun numero 3 fra le fasi di conteggio', f(0.1).numero !== 3 && f(3).numero !== 3)
v(
  'etichette: attesa, UNO, DUE, TRE',
  etichetta(f(12)) === '5' && etichetta(f(6)) === 'UNO' && etichetta(f(2)) === 'DUE' &&
    etichetta(f(0)) === 'TRE',
  [etichetta(f(12)), etichetta(f(6)), etichetta(f(2)), etichetta(f(0))].join(','),
)

// i due intervalli restano indipendenti
const asimm = { attesaSecondi: 4, secondiDa1A2: 8, secondiDa2A3: 2 }
v('asimmetrico: durata 4 + 8 + 2 = 14s', durataTotale(asimm) === 14, String(durataTotale(asimm)))
const g = (sec) => conteggio(S, S - sec * 1000, asimm)
v('asimmetrico: 12s = attesa', g(12).fase === 'attesa')
v('asimmetrico: 9.9s = UNO', g(9.9).numero === 1, JSON.stringify(g(9.9)))
v('asimmetrico: 2.1s = UNO (dura 8s)', g(2.1).numero === 1, JSON.stringify(g(2.1)))
v('asimmetrico: 1.9s = DUE (dura 2s)', g(1.9).numero === 2, JSON.stringify(g(1.9)))
v('asimmetrico: 0s = TRE', g(0).fase === 'scaduta')

// 1→2 rapido, 2→3 lento, senza attesa iniziale
const asimm2 = { attesaSecondi: 0, secondiDa1A2: 1, secondiDa2A3: 5 }
v('attesa 0: durata 0 + 1 + 5 = 6s', durataTotale(asimm2) === 6)
const h = (sec) => conteggio(S, S - sec * 1000, asimm2)
v('attesa 0: subito UNO', h(6 - 0.001).numero === 1, JSON.stringify(h(6 - 0.001)))
v('1→2 rapido: a 4.9s gia DUE', h(4.9).numero === 2, JSON.stringify(h(4.9)))
v('2→3 lento: a 1s ancora DUE', h(1).numero === 2)
v('2→3 lento: a 0s TRE', h(0).fase === 'scaduta')

console.log(`\n${ok} superate, ${ko} fallite`)
process.exit(ko ? 1 : 0)
