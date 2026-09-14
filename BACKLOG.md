# Backlog

Idee di sviluppo per l'app, ordinate per utilità rispetto alle aste.
Fatto = presente nell'app; le altre voci non sono ancora implementate.

## Fatto

- Import listone Excel di fantacalcio.it (fogli Tutti/Ceduti, ruoli Classic e Mantra)
- Listone con ricerca, filtri per ruolo e squadra, ordinamenti
- Registrazione acquisti di tutte le squadre, budget e offerta massima
- Rosa per ruolo con multiruolo Mantra in tutte le caselle
- Obiettivi con priorità, prezzo massimo e note; import da lista o JSON, export JSON
- Piano di spesa per reparto con avvisi di sforamento
- Scarsità per ruolo a fasce e indicatori di mercato
- Miglior formazione per ogni modulo Mantra, con tabella dei moduli modificabile
- Backup/ripristino JSON, annulla ultimo acquisto
- Pubblicazione automatica su GitHub Pages
- Aste multiple con nome, modalità indipendente, cambio rapido, duplica ed elimina
- Report di fine asta: spesa per reparto, affari e sovrapprezzi, confronto squadre, copertura club
- Cronologia dell'asta filtrabile per squadra
- Export Excel della rosa e del tabellone completo, rosa in testo per la chat
- Asta live sincronizzata su Supabase: tabellone condiviso, rilanci dai telefoni,
  conteggio "uno due tre" con tempi configurabili, validazione lato server
- Modalità chiamata: barra di trattativa con offerta massima propria e degli avversari
- Avvisi di sforamento del budget nel dialog e nella barra di chiamata
- Export CSV delle rose nel formato di caricamento di fantacalcio.it
- Asta a sorteggio: estrazione del prossimo giocatore, da tutto il listone o da un reparto

## Priorità alta

### Prova generale dell'asta live
Provare la sessione live con almeno tre dispositivi veri prima di usarla in
un'asta che conta: rilanci simultanei, telefono che perde la linea e rientra,
progetto Supabase risvegliato dalla pausa. Finché non è fatta, tenere pronta
l'asta locale come piano di riserva.

### Immagine della rosa
Export della rosa come immagine da condividere, oltre al testo e all'Excel già presenti.

## Priorità media

### Suggerimento prezzo migliorato
Oggi il prezzo suggerito distribuisce i crediti sull'FVM. Possibili affinamenti:
tenere conto dell'inflazione reale dell'asta in corso (quanto si sta pagando sopra
o sotto il suggerito), della scarsità del ruolo e del budget residuo degli avversari.

### Coppie e alternative
Legare più giocatori in un gruppo ("uno di questi tre"), così quando ne prendi uno
gli altri escono automaticamente dagli obiettivi e il budget si libera.

### Moduli: cosa comprare per migliorare
Estensione della sezione Moduli: dato un modulo, indicare quali ruoli ancora disponibili
in asta farebbero crescere di più la formazione, e di quanto. In pratica il collegamento
diretto tra "mi manca un Dc" e la lista dei Dc ancora sul mercato.

### Import obiettivi da immagine
Caricare direttamente lo screenshot di una lista e riconoscerne i nomi, invece di
incollare il testo.

## Priorità bassa

### Dati aggiuntivi sui giocatori
Import di fantamedia, presenze, gol e assist della stagione precedente, e indicatore
di titolarità. Serve una seconda fonte dati oltre al listone quotazioni.

### Note e tag personali
Etichette libere sui giocatori ("rigorista", "in dubbio", "da evitare") con filtro
nel listone, persistenti tra le aste.

### Confronto rapido
Selezionare due o tre giocatori e vederli affiancati con quotazione, FVM, ruoli e
prezzo suggerito.

### Simulatore
Prova a inserire acquisti ipotetici per vedere l'effetto su budget e slot senza
sporcare i dati reali.

### Preferenze di visualizzazione
Colonne configurabili nel listone, densità delle righe, dimensione del testo.

## Da valutare (proposte 2026-09-14)

Dieci idee messe sul tavolo dopo la prima asta live vera. L'ordine è quello che
proporrei di seguire, non quello in cui sono venute in mente.

### 1. Pausa dell'asta live
Un pulsante che congela tutto: conteggio fermo, offerte rifiutate, sui telefoni la
scritta che l'asta è sospesa. Lo stato `paused` esiste già nello schema e nessuno lo
usa. È la prima cosa che serve quando qualcuno deve alzarsi da tavola o nasce una
discussione. Piccola.

### 2. Suono del conteggio sui telefoni
Un tono su *uno, due, tre* e uno diverso sull'aggiudicazione. In una stanza rumorosa
il conteggio a schermo si perde, e chi guarda altrove scopre tardi di essere stato
superato. Costa pochissimo e si sente subito.

### 3. Chi ha fame di cosa
Per ogni avversario: quali reparti gli mancano, quanti crediti ha, e quanto può
spendere in media per ogni slot che gli resta. Trasforma «Gennaro ha 800 crediti» in
«Gennaro *deve* prendere due portieri, sul prossimo tirerà». Oggi la scheda Squadre
dà i numeri grezzi ma non la lettura.

### 4. Inflazione dell'asta, in diretta
Un numero solo: quanto la stanza sta pagando sopra o sotto il prezzo suggerito,
aggiornato a ogni acquisto. Serve a ritarare i propri massimi a metà strada, invece
di scoprire alla fine di aver comprato tutto caro o di essere rimasto con 900 crediti
in mano.

### 5. Turno di chiamata
Chi chiama adesso, visibile su tutti i telefoni, con rotazione automatica. Molte
leghe chiamano a giro invece che a sorteggio, e tenere il conto a voce è una fonte
sicura di litigi.

### 6. Import delle rose da CSV
L'inverso dell'export appena fatto: caricare rose già esistenti — quelle dell'anno
scorso, o quelle di un'altra lega — per partire da una situazione e non dal vuoto.
Stesso formato, letto al contrario.

### 7. Storico prezzi fra le aste
Salvare a quanto è andato davvero ogni giocatore, asta dopo asta. L'anno prossimo il
prezzo suggerito nasce da quanto paga *la tua lega*, non dal listino: con 8 squadre e
4000 crediti le distorsioni sono sempre le stesse e si ripetono. È l'unica voce che
vale di più ogni anno che passa.

### 8. Asta di riparazione
Una seconda fase sulla rosa esistente: svincoli che restituiscono crediti, nuovi
acquisti, slot da rispettare. Oggi per il mercato di gennaio bisognerebbe ricostruire
tutto a mano.

### 9. App installabile sul telefono
Il terminale del partecipante come icona sulla schermata iniziale, con l'ultimo stato
visibile anche se la linea cade. Toglie di mezzo il «qual era il link?» e la barra del
browser, che su uno schermo piccolo si mangia lo spazio del conteggio.

### 10. Annulla e ripeti completi
Oggi si annulla solo l'ultimo acquisto. In un'asta confusa capita di accorgersi tre
chiamate dopo di aver scritto il prezzo sbagliato o la squadra sbagliata, e servirebbe
tornare indietro di più passi senza rovinare la cronologia.

## Rimandate

- **Logging** delle azioni (l'utente lo ha esplicitamente rimandato)
- **Condivisione e multiutente**: più partecipanti che vedono la stessa asta in tempo
  reale. Richiede un backend, oggi l'app è interamente locale al browser.
