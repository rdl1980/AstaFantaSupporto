import { conteggio, etichetta, durataTotale } from '../src/live/countdown.ts'
let ok=0, ko=0
const v=(d,c,x='')=>{ c?(ok++,console.log('  ok   '+d)):(ko++,console.log('  FAIL '+d+(x?' → '+x:''))) }

// attesa 5s, intervallo 3s → durata totale 14s
const cfg={attesaSecondi:5,intervalloSecondi:3}
v('durata totale = attesa + 3 intervalli', durataTotale(cfg)===14)
const S=100000
const f=(sec)=>conteggio(S, S-sec*1000, cfg)   // sec = secondi rimanenti
v('14s rimanenti: attesa, 5s all inizio del conteggio', f(14).fase==='attesa' && Math.abs(f(14).alConteggio-5)<1e-9, JSON.stringify(f(14)))
v('10s rimanenti: ancora attesa', f(10).fase==='attesa')
v('9.5s rimanenti: ancora attesa (soglia non toccata)', f(9.5).fase==='attesa')
v('9s rimanenti: parte UNO', f(9).fase==='conteggio' && f(9).numero===1, JSON.stringify(f(9)))
v('7s rimanenti: UNO', f(7).numero===1)
v('6s rimanenti: DUE', f(6).numero===2)
v('4s rimanenti: DUE', f(4).numero===2)
v('3s rimanenti: TRE', f(3).numero===3)
v('0.1s rimanenti: TRE', f(0.1).numero===3)
v('0s: scaduta', f(0).fase==='scaduta')
v('oltre la scadenza: scaduta', f(-5).fase==='scaduta')
v('etichette', etichetta(f(14))==='5' && etichetta(f(9))==='UNO' && etichetta(f(6))==='DUE' && etichetta(f(3))==='TRE' && etichetta(f(0))==='AGGIUDICATO')

// configurazione diversa: attesa lunga, conteggio lento
const lento={attesaSecondi:12,intervalloSecondi:5}
v('config lenta: durata 27s', durataTotale(lento)===27)
const g=(sec)=>conteggio(S,S-sec*1000,lento)
v('config lenta: 20s rimanenti = attesa', g(20).fase==='attesa' && Math.abs(g(20).alConteggio-5)<1e-9)
v('config lenta: 15s = UNO', g(15).numero===1)
v('config lenta: 10s = DUE', g(10).numero===2)
v('config lenta: 4s = TRE', g(4).numero===3)

// attesa zero: il conteggio parte subito
const secco={attesaSecondi:0,intervalloSecondi:2}
v('attesa 0: durata 6s', durataTotale(secco)===6)
v('attesa 0: subito UNO', conteggio(S,S-6000+1,secco).numero===1, JSON.stringify(conteggio(S,S-6000+1,secco)))

// intervallo 1s: conteggio rapido
const rapido={attesaSecondi:3,intervalloSecondi:1}
const h=(sec)=>conteggio(S,S-sec*1000,rapido)
v('rapido: 4s = attesa', h(4).fase==='attesa')
v('rapido: 2.5s = UNO', h(2.5).numero===1)
v('rapido: 1.5s = DUE', h(1.5).numero===2)
v('rapido: 0.5s = TRE', h(0.5).numero===3)

console.log(`\n${ok} superate, ${ko} fallite`)
process.exit(ko?1:0)
