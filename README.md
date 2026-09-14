# Asta Fanta Supporto ⚽

App di supporto per le aste del fantacalcio (fantacalcio.it), modalità **Mantra** e **Classic**.
Uso locale, single-utente: tutti i dati restano nel browser (localStorage), nessun backend.

## Avvio

```bash
npm install
npm run dev
```

Poi apri http://localhost:5173.

## Come si usa

1. **Setup** — importa il file Excel delle quotazioni scaricato da fantacalcio.it
   (fogli `Tutti` + `Ceduti`; colonne `R` = ruolo Classic, `RM` = ruoli Mantra).
   Configura modalità, budget, numero squadre, slot di rosa e nomi delle squadre.
   Puoi reimportare il listone definitivo poco prima dell'asta: acquisti e obiettivi vengono mantenuti.
2. **Asta** — layout a due colonne per PC:
   - **Listone**: ricerca istantanea (tasto `/` per il focus, Invio apre il primo risultato),
     filtri per ruolo/squadra, ordinamento per FVM/quotazione/nome, stella ★ per gli obiettivi.
   - **Dialog acquisto**: prezzo + assegnazione a una delle squadre (scorciatoie tasti 1-8),
     con prezzo suggerito, tuo prezzo massimo e offerta massima possibile.
   - **Rosa**: raggruppata per ruolo; in Mantra i multiruolo appaiono in tutte le loro caselle.
   - **Squadre**: budget residuo, slot e rosa di tutti i partecipanti.
   - **Pressione**: chi ha fame di quale reparto e quanto può ancora spendere, più l'inflazione
     dell'asta in corso (vedi sotto).
   - **Obiettivi**: piano di spesa per reparto + lista dei target (vedi sotto).
   - **Scarsità**: quanto vale ancora il mercato e cosa resta per ruolo (vedi sotto).
   - **Annulla ultimo**, **Backup/Ripristina** (JSON) dalla barra in alto.
   - **🔨 Chiamata**: modalità di trattativa assistita (vedi sotto).
3. **Report** — analisi di fine asta, export ed elenco cronologico (vedi sotto).

## Aste multiple

L'app tiene più aste salvate insieme: ognuna ha le sue regole, il suo listone, i suoi obiettivi e i
suoi acquisti. Si passa dall'una all'altra dal selettore in alto a sinistra, e si gestiscono tutte
dalla card **Aste salvate** nel setup (rinomina, duplica, elimina).

Il pulsante **＋** apre la creazione di una nuova asta: nome libero, **numero di partecipanti da 2 a
10** e modalità già impostata su quella opposta a quella corrente, che è il caso tipico (finito il
Mantra, si prepara il Classic). Si sceglie cosa riportare dall'asta corrente — squadre e budget,
listone importato, obiettivi — mentre gli acquisti non vengono mai riportati: la nuova asta parte da
zero.

Il **numero di partecipanti si fissa alla creazione e non cambia più**. I nomi delle squadre restano
invece modificabili in qualsiasi momento. Il vincolo non è capriccioso: le squadre esistono anche
come righe nella sessione live, e l'app le accoppia per posizione — cambiarne il numero a metà strada
scombinerebbe rose, crediti e collegamenti dei partecipanti. Per un numero diverso si crea una nuova
asta.

## Dove finiscono i dati

Tutto è salvato nel `localStorage` del browser, sotto la chiave `asta-fanta-vault-v2`: tutte le aste
salvate più il riferimento a quella attiva. Nessun server, nessun account. Chi arriva dalla versione a
singola asta viene migrato automaticamente al primo avvio, e la vecchia chiave `asta-fanta-state-v1`
resta intatta come rete di sicurezza.

Il `localStorage` è separato per indirizzo: i dati su `localhost:5173` e quelli sulla versione
pubblicata su GitHub Pages sono due archivi distinti. Per spostarli usa
**⬇ Backup** e **⬆ Ripristina** dalla barra in alto: il backup riguarda **l'asta attiva**, e il
ripristino la sovrascrive, quindi si possono usare anche per travasare una singola asta da un
dispositivo all'altro. Se il browser esaurisce lo spazio compare un avviso in cima: da lì conviene
fare subito un backup ed eliminare un'asta vecchia.

## Piano di spesa e obiettivi

Ripartizione del budget per reparto in percentuale (P/D/C/A, basata sul ruolo Classic anche in Mantra,
come il listone). Per ogni reparto: crediti allocati, spesi e liberi, slot da riempire, obiettivi in lista
e somma dei loro prezzi massimi, con avviso quando i target valgono più del budget del reparto o quando
gli obiettivi non bastano a coprire gli slot. In Mantra i giocatori previsti per reparto sono una stima
di pianificazione (i 29 di movimento non hanno quote fisse per ruolo).

Gli obiettivi hanno una **priorità** (Prio1, Prio2, Low, Scommessa) che ne determina l'ordinamento
dentro ogni reparto.

### Import e export degli obiettivi

**⬍ Importa obiettivi** accetta due formati, riconosciuti automaticamente:

- **lista di nomi**, uno per riga, con prezzo massimo opzionale dopo `=`, `:` o `|`;
- **JSON**, incollato o caricato da file con *📂 Carica file JSON*.

I nomi vengono riconosciuti contro il listone anche se scritti in forma diversa: "Lautaro Martinez"
trova `Martinez L.`, "Josep Martinez" trova `Martinez Jo.`. Le voci ambigue mostrano una tendina di
scelta, quelle non riconosciute restano segnalate senza bloccare le altre.

Il formato JSON è tollerante: un array semplice oppure un oggetto con la chiave `targets`, e ogni voce
può essere una stringa o un oggetto. `priority` accetta sia numeri (1–4) sia etichette (`prio1`, `low`,
`scommessa`). Con `id` si punta esattamente a un giocatore del listone saltando il riconoscimento.

```json
{
  "targets": [
    { "name": "Calhanoglu", "priority": 1, "maxPrice": 300, "note": "rigorista" },
    "Dimarco",
    { "id": 254, "priority": 2 }
  ]
}
```

**⬇ Esporta JSON** scarica gli obiettivi correnti nello stesso formato, arricchiti con id, squadra e
ruoli, così puoi rileggerli o riusarli in un'altra lega.

## Moduli (solo Mantra)

Per ogni modulo della tabella Mantra mostra la **migliore formazione schierabile** con i giocatori
che hai in rosa, ordinando i moduli per slot coperti e poi per FVM totale. Gli slot scoperti sono
elencati in cima alla scheda ("manca: Dc, E, A/Pc"), così sai cosa ti serve mentre l'asta è in corso.

L'assegnazione non è golosa: dato che un multiruolo può occupare slot diversi, la scelta migliore per
uno slot dipende da tutte le altre, quindi si risolve come abbinamento ottimo su grafo bipartito
(flusso di costo minimo in [src/lineup.ts](src/lineup.ts)).

La tabella dei moduli è modificabile dall'app con **✎ Modifica tabella**: un modulo per riga, nel
formato `Nome: slot, slot, …` con 11 slot, dove uno slot che accetta più ruoli si scrive `Dc/B`.
Serve se la tua lega usa una tabella diversa da quella predefinita.

## Modalità chiamata

Il pulsante **🔨 Chiamata** cambia cosa succede quando clicchi un giocatore nel listone: invece del
dialog compare una barra sotto l'intestazione, che resta lì per tutta la trattativa e lascia il
listone visibile. La barra mostra il giocatore in asta con quotazione, prezzo suggerito, il tuo
prezzo massimo se è un obiettivo, la sua posizione nel ruolo, e soprattutto **fino a quanto puoi
arrivare** tu e **quali avversari possono ancora superarti**: man mano che alzi il prezzo, chi non
può più permetterselo viene barrato.

Per registrare basta scrivere il prezzo e cliccare la squadra: nessun dialog da confermare. `Invio`
assegna alla squadra già selezionata, `Esc` chiude la chiamata. Riaprendo un giocatore già assegnato
la barra si precompila e offre lo svincolo.

L'interruttore è salvato nell'asta, quindi resta come lo lasci. Con la modalità spenta tutto funziona
come prima. Il click dalla rosa, dalle squadre o dagli obiettivi apre sempre il dialog, perché lì si
va per correggere un acquisto, non per farne uno.

## Avvisi sul budget

Sia il dialog sia la barra di chiamata segnalano quando il prezzo supera i crediti della squadra
scelta, o quando lascia scoperti gli slot ancora da riempire (l'offerta massima tiene un credito da
parte per ognuno). Sono avvisi, non blocchi: servono a intercettare l'errore di battitura — 650 al
posto di 65 — senza impedirti di registrare quello che è successo davvero.

## Asta live sincronizzata

I partecipanti seguono e rilanciano dal telefono, mentre il banditore continua a usare l'app come
sempre. Richiede un progetto Supabase gratuito: la messa in piedi è descritta in
[supabase/README.md](supabase/README.md), la progettazione in
[DESIGN-ASTA-LIVE.md](DESIGN-ASTA-LIVE.md).

### Come si manda un giocatore all'asta

Con la sessione live avviata, nella barra c'è il campo **"Chi va all'asta? scrivi il nome…"**: si
digitano due lettere, compaiono i nomi, e con un clic (o `Invio` sul primo) il giocatore parte. In
alternativa lo si clicca nel listone e poi si preme **🔨 Metti all'asta**. Non serve accendere nulla:
con una sessione live attiva il clic sul listone apre sempre la trattativa, e l'interruttore
*Chiamata* — che serve solo per l'asta in locale — sparisce dalla barra.

Nella schermata d'asta compare **Avvia sessione live**, che genera un codice stanza e un link
`…/?asta=CODICE` da mandare al gruppo. Chi lo apre sceglie la propria squadra — una sola volta, poi
quel dispositivo è legato a quella squadra — e si ritrova un terminale con i propri crediti, il
giocatore in asta, l'offerta corrente e i pulsanti per rilanciare.

Dall'intestazione si arriva a due viste: **La mia rosa**, con i giocatori presi divisi per reparto,
quanti ne mancano per completarlo, crediti spesi e residui e offerta massima; e **Tabellone**, con
la situazione di tutte le squadre. Sono le domande che vengono in mente mentre si aspetta la
chiamata successiva, e adesso hanno una risposta senza chiedere al banditore.

### I tempi della chiamata

Il conteggio segue la cadenza dell'asta vera: dopo l'ultima offerta si aspetta, poi parte *uno, due,
tre*, e alla fine il giocatore è aggiudicato. Ogni rilancio fa ripartire tutto da capo. Dal Setup si
configurano i due tempi:

- **attesa prima del conteggio** — i secondi che passano dall'offerta all'inizio del conteggio;
- **secondi da uno a due** e **secondi da due a tre** — la cadenza dei numeri, regolabile
  separatamente per i due intervalli.

Il &ldquo;tre&rdquo; è il colpo di martello: da quell'istante **il server non accetta più offerte** e il
giocatore è aggiudicato. L'esito — &ldquo;AGGIUDICATO&rdquo;, con il prezzo e la squadra che se l'è
preso — resta a schermo tre secondi, il tempo di far leggere com'è finita, e sono tre secondi di
sola facciata sul singolo dispositivo: l'asta è già chiusa e si può chiamare subito il giocatore
successivo. Se la chiamata scade senza offerte compare solo il &ldquo;tre&rdquo;, perché non c'è
nulla da aggiudicare.

Fra il &ldquo;tre&rdquo; e il verdetto il telefono scrive *chiusura…* invece di annunciare un
vincitore. La differenza conta: il conteggio è calcolato da ogni dispositivo, mentre chi si è preso
il giocatore lo sa solo il server. Un rilancio arrivato nell'ultimo istante fa ripartire il
conteggio, e prima quel dispositivo aveva già dichiarato un'aggiudicazione che veniva poi smentita.

### Rilanciare senza sbagliare cifra

I pulsanti rapidi — **+1, +5, +10** di serie, fino a quattro scalini configurabili dal Setup —
mostrano ciascuno anche la cifra a cui portano, così si offre leggendo un numero e non facendo un
conto.

Dopo ogni cambio di prezzo i pulsanti restano bloccati per un attimo (800 millisecondi di serie),
perché il caso peggiore è toccare &ldquo;+1&rdquo; nell'istante in cui la base si muove e ritrovarsi
ad aver offerto tutt'altro. Un'offerta che parte comunque su una base ormai vecchia non viene
corretta al rialzo: il server la **rifiuta** e mostra il prezzo aggiornato, perché un rilancio
rapido vale solo sulla base che si stava guardando. L'offerta libera, invece, è una cifra voluta e
passa a prescindere da come si è mossa la base.

Il conteggio non viaggia sulla rete: il server trasmette solo l'istante di scadenza, e ogni
dispositivo ricava da sé la fase in cui si trova. Così tutti vedono lo stesso numero senza un flusso
di messaggi, e chi si riconnette a metà conteggio si riallinea da solo. Per evitare che un telefono
con l'ora sbagliata veda un conteggio diverso, viene misurato lo scarto rispetto all'orologio del
server — all'avvio e poi ogni cinque minuti, perché su un'asta di tre ore la deriva si fa sentire.

Il realtime è un'ottimizzazione, non una dipendenza. Un canale WebSocket può morire in silenzio, e
quando succede lo schermo resta fermo su una cifra vecchia: è successo davvero, e a rilanciare su un
prezzo sbagliato ci si accorge tardi. Perciò il canale viene ricostruito da capo quando va in
errore, distanziando i tentativi, e mentre un giocatore è in asta ogni dispositivo rilegge comunque
la chiamata una volta al secondo. È una riga sola per otto telefoni, e si paga solo nei minuti in
cui serve.

### Pausa

Il pulsante **⏸ Pausa** nella barra del banditore ferma tutto: il conteggio si blocca dov'è, le
offerte vengono rifiutate con un messaggio che dice perché, e sui telefoni compare una fascia
arancione che non si può non vedere. **▶ Riprendi** riparte dal punto esatto.

Il conteggio non viaggia sulla rete: ogni dispositivo lo ricava dall'istante di scadenza, che è
assoluto e durante la pausa scorrerebbe via da solo. Perciò il server non si limita a cambiare
stato — mette da parte quanti millisecondi mancavano al martello e cancella la scadenza. Finché
l'asta è sospesa non esiste un istante in cui il martello cade, e alla ripresa la scadenza si
ricostruisce sommando a quel momento il tempo che era rimasto.

Sospendere un attimo *dopo* che il tempo è scaduto non regala secondi in più: il tempo rimasto non
scende sotto zero, e alla ripresa il giocatore viene aggiudicato subito, com'è giusto. Mentre è
sospesa non si può nemmeno chiamare un altro giocatore: riattiverebbe l'asta di nascosto, e chi ha
il telefono in mano non capirebbe cosa è successo.

### Il tono del conteggio

L'altoparlante 🔊 nell'intestazione del telefono accende i suoni: un tono corto su *uno* e *due*,
uno più grave e lungo sul *tre*, due note che salgono sull'aggiudicazione, e un avviso quando
**qualcuno supera la tua offerta**. Quest'ultimo è il motivo per cui la funzione esiste: in una
stanza di otto persone che parlano, chi guarda altrove scopre tardi di essere stato superato.

I suoni sono sintetizzati sul momento, non file da caricare: pochi byte invece di un download che
potrebbe non essere finito quando serve. Il browser non lascia suonare finché non c'è stato un
tocco, quindi l'audio si sblocca proprio quando si preme l'interruttore; la preferenza resta salvata
su quel dispositivo. Si suona sui passaggi di fase, non a ogni ridisegno: senza quella accortezza il
telefono farebbe un ronzio continuo.

### Gli acquisti restano allineati nei due sensi

Tutto il resto dell'app — rosa, budget, scarsità, moduli, report, export — legge gli acquisti
dell'asta locale. Perciò, con una sessione live attiva, i due lati si tengono allineati da soli: un
giocatore aggiudicato dai telefoni compare subito nell'app del banditore, e un acquisto registrato a
mano nell'app sale sul server, così i partecipanti lo vedono nel loro tabellone e nei budget.

L'allineamento aggiunge e corregge; cancella soltanto ciò che il server aveva e non ha più. Uno
svincolo o un *Annulla ultimo* viene quindi propagato anche alla sessione live, altrimenti il
giocatore ricomparirebbe dopo un istante. Va da sé che gli acquisti si gestiscono dall'app: se si
cancella una riga direttamente sul database mentre l'app è aperta, questa la rimetterà al suo posto.

### Cosa decide il server

Ogni rilancio è validato da una funzione Postgres che lavora sotto lock di riga: le offerte
simultanee si accodano e vengono processate una alla volta, quindi a parità di cifra la prima
arrivata vince e la seconda riceve "offerta superata". La stessa funzione verifica i crediti
residui, l'offerta massima possibile lasciando un credito per ogni slot ancora da riempire, e che
il ruolo del giocatore non sia già completo. Il client fa gli stessi calcoli per disabilitare i
pulsanti, ma la decisione resta del server.

```bash
npm test
```

collauda le funzioni SQL su un Postgres in WASM, senza database installato.

## Report ed export

Il pulsante **📊 Report** apre una schermata che legge l'asta e la racconta:

- **La tua asta**: giocatori, speso, residuo, valore suggerito della rosa, FVM totale e posizione
  per FVM tra le squadre della lega.
- **Spesa per reparto**: quanto è finito in ogni reparto contro il piano, in crediti e in percentuale.
- **Affari e pagati cari**: gli acquisti più lontani dal prezzo suggerito, nei due sensi.
- **Confronto squadre**: FVM totale, spesa, residuo e FVM per credito di tutti i partecipanti.
- **Copertura squadre di Serie A**: quanti club sono rappresentati; quelli con quattro o più tuoi
  giocatori sono evidenziati, perché legano la tua giornata alla loro.
- **La tua rosa** e **cronologia dell'asta**, quest'ultima filtrabile per squadra.

Gli scostamenti sono calcolati sul prezzo suggerito dall'app: dicono se hai comprato sopra o sotto
la media della lega, non se hai comprato bene.

Quattro export dalla stessa barra:

- **⬇ Excel rosa** — la tua rosa in `.xlsx`, con prezzo, suggerito, scostamento, quotazione e FVM.
- **⬇ Excel tabellone** — un foglio di riepilogo, uno con tutti gli acquisti della lega e uno per
  squadra. I nomi dei fogli sono ripuliti dai caratteri che Excel rifiuta e resi unici.
- **⬇ CSV per fantacalcio.it** — le rose di tutte le squadre nel formato che il sito accetta per il
  caricamento.
- **📋 Rosa per chat** — la rosa in testo compatto negli appunti, pronta da incollare.

I primi due sono file Excel veri, scritti con SheetJS: si aprono senza domande sul separatore.

### Il CSV per fantacalcio.it

Il formato è una sequenza di blocchi, ognuno aperto dalla riga `$,$,$` e seguito da una riga
`squadra,idGiocatore,prezzo` per giocatore. Niente intestazione, niente nomi, niente ruoli: l'id è
quello della colonna `Id` del listone, la stessa da cui l'app importa, quindi le rose costruite qui
si ricaricano sul sito senza passaggi manuali.

È stato ricavato da un export vero, byte per byte — fine riga `
`, nessun BOM, un a capo finale,
il separatore anche prima della prima squadra. Dettagli che contano perché dall'altra parte c'è un
lettore rigido, non un foglio di calcolo. All'interno di ogni squadra i giocatori escono per reparto
e poi dal più caro, che è l'ordine con cui si legge una rosa; una virgola in un nome squadra viene
tolta, perché il formato non prevede virgolette e spezzerebbe la riga.

## Asta a sorteggio

Invece di chiamare i giocatori a turno, li estrae l'app: nella schermata d'asta il pulsante
**🎲 Estrai** pesca il prossimo e lo mette direttamente in trattativa. Dal Setup si sceglie da dove
pescare:

- **lista completa** — da tutti i giocatori ancora liberi;
- **un reparto alla volta** — accanto al pulsante compaiono P/D/C/A e si sceglie da quale pescare,
  come fanno le leghe che finiscono i portieri prima di passare ai difensori.

Anche in Mantra il reparto è quello Classic. I ruoli Mantra sono undici e un giocatore ne ha più
d'uno, quindi non dividono il listone in gruppi netti: per pescare serve una partizione, e l'unica
che ce l'ha è quella dei reparti.

Chi esce e non viene assegnato resta fuori dal mazzo, così non si ripresenta al colpo dopo; accanto
al pulsante si legge quanti ne restano. Quando il mazzo finisce si rimescola con quelli avanzati
invece di rispondere «finito», perché a metà asta restano quasi solo i giocatori che nessuno aveva
voluto al primo giro — ed è proprio quelli che bisogna ancora assegnare.

## Pressione e inflazione

La scheda **Pressione** risponde alle due domande che ci si fa mentre un giocatore è in trattativa e
a cui il resto dell'app non rispondeva.

### Inflazione dell'asta

Un numero solo: quanto la stanza sta pagando sopra o sotto il prezzo suggerito, aggiornato a ogni
acquisto e visibile anche come indicatore nella barra in alto. Il suggerito nasce dall'FVM ed è una
misura di **valore**; il **mercato** lo fanno le persone sedute al tavolo. Sapere di quanto si
discostano serve a ritarare i propri massimi a metà strada, invece di scoprire alla fine di aver
comprato tutto caro — o di essere rimasti con novecento crediti in mano e la rosa da completare.

Si guarda il rapporto fra totale pagato e totale suggerito, non la media degli scostamenti: un
portiere da 1 credito pagato 3 triplicherebbe la media pur spostando il mercato di due crediti.
Sotto gli otto acquisti il numero non compare, perché sarebbe rumore.

Il dato è calcolato anche **per reparto**, perché portieri e attaccanti non si gonfiano allo stesso
modo. Nella barra di chiamata il suggerito compare così: `547 → 199`, cioè il prezzo a cui quel
giocatore andrebbe al ritmo di *questa* asta. Si usa lo scostamento del suo reparto quando ha
abbastanza acquisti alle spalle, altrimenti quello generale; senza né l'uno né l'altro il suggerito
resta com'è, perché meglio nessuna correzione di una inventata su tre acquisti.

### Chi ha fame di cosa

Una riga per squadra, ordinate per **crediti per slot**: quanto resta a ciascuno per ogni casella
ancora vuota. È la cifra che separa «ha ottocento crediti» da «deve spenderli»: una squadra con due
portieri ancora da prendere è costretta, e sul prossimo portiere tirerà; una con la rosa quasi
completa può stare ferma. Accanto, i reparti ancora scoperti con quanti ne mancano, i residui e il
massimo su un singolo giocatore.

Chi ha la rosa completa non mostra un valore per slot: i crediti che gli avanzano non comprano più
niente e non fanno pressione su nessuno. In Mantra i reparti sono portieri e movimento, perché i
giocatori di movimento non hanno quote per ruolo.

La stessa lettura arriva nella barra di chiamata: gli avversari che devono ancora coprire **quel**
reparto sono segnati con un pallino e in evidenza, gli altri restano sbiaditi. Non «chi ha crediti»,
ma chi ha crediti *e* quel buco da riempire — sono quelli che rilanciano davvero.

## Scarsità

- **Mercato**: crediti e slot ancora in gioco, media per slot della lega, e quanto vale uno slot per te
  rispetto agli avversari — dice se puoi permetterti di alzare o se devi cercare occasioni.
- **Per ruolo**: i giocatori sono divisi in fasce dimensionate sul numero di squadre (Top = uno a testa,
  Buoni = altrettanti, Medi = il doppio) e per ognuna vedi quanti ne restano. In Classic è indicato anche
  quanti slot deve ancora riempire la lega in quel ruolo; in Mantra solo per i portieri, perché gli altri
  ruoli si sovrappongono. Con "ordina per scarsità" i ruoli a rischio salgono in cima.
- Nel dialog d'acquisto compare la posizione del giocatore tra i disponibili del suo ruolo
  (es. "3° miglior W su 42 disponibili").

## Prezzo suggerito

Distribuisce tutti i crediti della lega (budget × squadre) sul pool dei migliori N giocatori
disponibili (N = slot totali × squadre), proporzionalmente all'FVM della modalità attiva.
È indicativo e si ricalibra automaticamente su budget e dimensione della lega.

## Stack

Vite + React + TypeScript, [SheetJS](https://sheetjs.com/) per il parsing Excel. Nessuna altra dipendenza.
