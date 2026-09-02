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
   - **Obiettivi**: piano di spesa per reparto + lista dei target (vedi sotto).
   - **Scarsità**: quanto vale ancora il mercato e cosa resta per ruolo (vedi sotto).
   - **Annulla ultimo**, **Backup/Ripristina** (JSON) dalla barra in alto.
   - **🔨 Chiamata**: modalità di trattativa assistita (vedi sotto).
3. **Report** — analisi di fine asta, export ed elenco cronologico (vedi sotto).

## Aste multiple

L'app tiene più aste salvate insieme: ognuna ha le sue regole, il suo listone, i suoi obiettivi e i
suoi acquisti. Si passa dall'una all'altra dal selettore in alto a sinistra, e si gestiscono tutte
dalla card **Aste salvate** nel setup (rinomina, duplica, elimina).

Il pulsante **＋** apre la creazione di una nuova asta: il nome è libero e la modalità è già
impostata su quella opposta a quella corrente, che è il caso tipico (finito il Mantra, si prepara il
Classic). Si sceglie cosa riportare dall'asta corrente — squadre e budget, listone importato,
obiettivi — mentre gli acquisti non vengono mai riportati: la nuova asta parte da zero.

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

Tre export dalla stessa barra:

- **⬇ Excel rosa** — la tua rosa in `.xlsx`, con prezzo, suggerito, scostamento, quotazione e FVM.
- **⬇ Excel tabellone** — un foglio di riepilogo, uno con tutti gli acquisti della lega e uno per
  squadra. I nomi dei fogli sono ripuliti dai caratteri che Excel rifiuta e resi unici.
- **📋 Rosa per chat** — la rosa in testo compatto negli appunti, pronta da incollare.

Sono file Excel veri, scritti con SheetJS, non CSV: si aprono senza domande sul separatore.

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
