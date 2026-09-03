import { conteggio, etichetta, durataTotale } from '../src/live/countdown.ts'

let ok = 0
let ko = 0
const v = (d, c, x = '') => {
  c ? (ok++, console.log('  ok   ' + d)) : (ko++, console.log('  FAIL ' + d + (x ? ' → ' + x : '')))
}

// attesa 5s, 1→2 in 3s, 2→3 in 3s  →  totale 5 + 3 + 3 + 3 = 14s
const cfg = { attesaSecondi: 5, secondiDa1A2: 3, secondiDa2A3: 3 }
v('durata totale = attesa + (1→2) + due volte (2→3)', durataTotale(cfg) === 14, String(durataTotale(cfg)))
const S = 100000
const f = (sec) => conteggio(S, S - sec * 1000, cfg) // sec = secondi rimanenti
v('14s rimanenti: attesa, 5s al conteggio', f(14).fase === 'attesa' && Math.abs(f(14).alConteggio - 5) < 1e-9, JSON.stringify(f(14)))
v('10s rimanenti: ancora attesa', f(10).fase === 'attesa')
v('9.5s rimanenti: ancora attesa', f(9.5).fase === 'attesa')
v('9s rimanenti: parte UNO', f(9).fase === 'conteggio' && f(9).numero === 1, JSON.stringify(f(9)))
v('7s rimanenti: UNO', f(7).numero === 1)
v('6s rimanenti: DUE', f(6).numero === 2)
v('4s rimanenti: DUE', f(4).numero === 2)
v('3s rimanenti: TRE', f(3).numero === 3)
v('0.1s rimanenti: TRE', f(0.1).numero === 3)
v('0s: scaduta', f(0).fase === 'scaduta')
v('oltre la scadenza: scaduta', f(-5).fase === 'scaduta')
v(
  'etichette',
  etichetta(f(14)) === '5' && etichetta(f(9)) === 'UNO' && etichetta(f(6)) === 'DUE' &&
    etichetta(f(3)) === 'TRE' && etichetta(f(0)) === 'AGGIUDICATO',
)

// i due intervalli sono indipendenti: 1→2 lento, 2→3 rapido
const asimm = { attesaSecondi: 4, secondiDa1A2: 8, secondiDa2A3: 2 }
v('asimmetrico: durata 4 + 8 + 2 + 2 = 16s', durataTotale(asimm) === 16, String(durataTotale(asimm)))
const g = (sec) => conteggio(S, S - sec * 1000, asimm)
v('asimmetrico: 14s = attesa', g(14).fase === 'attesa')
v('asimmetrico: 12s = UNO (parte dopo i 4s di attesa)', g(12).numero === 1, JSON.stringify(g(12)))
v('asimmetrico: 5s = UNO (dura 8s)', g(5).numero === 1, JSON.stringify(g(5)))
v('asimmetrico: 3.9s = DUE', g(3.9).numero === 2, JSON.stringify(g(3.9)))
v('asimmetrico: 1.9s = TRE', g(1.9).numero === 3, JSON.stringify(g(1.9)))

// il contrario: 1→2 rapido, 2→3 lento
const asimm2 = { attesaSecondi: 0, secondiDa1A2: 1, secondiDa2A3: 5 }
v('attesa 0: durata 0 + 1 + 5 + 5 = 11s', durataTotale(asimm2) === 11)
const h = (sec) => conteggio(S, S - sec * 1000, asimm2)
v('attesa 0: subito UNO', h(11 - 0.001).numero === 1, JSON.stringify(h(11 - 0.001)))
v('1→2 rapido: a 10s gia DUE', h(10).numero === 2, JSON.stringify(h(10)))
v('2→3 lento: a 6s ancora DUE', h(6).numero === 2)
v('2→3 lento: a 4s TRE', h(4).numero === 3)

console.log(`\n${ok} superate, ${ko} fallite`)
process.exit(ko ? 1 : 0)
