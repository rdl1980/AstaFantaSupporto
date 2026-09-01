# Backlog

Idee di sviluppo per l'app, ordinate per utilità rispetto alle aste.
Fatto = presente nell'app; le altre voci non sono ancora implementate.

## Fatto

- Import listone Excel di fantacalcio.it (fogli Tutti/Ceduti, ruoli Classic e Mantra)
- Listone con ricerca, filtri per ruolo e squadra, ordinamenti
- Registrazione acquisti di tutte le squadre, budget e offerta massima
- Rosa per ruolo con multiruolo Mantra in tutte le caselle
- Obiettivi con prezzo massimo e note; import da lista incollata
- Piano di spesa per reparto con avvisi di sforamento
- Scarsità per ruolo a fasce e indicatori di mercato
- Backup/ripristino JSON, annulla ultimo acquisto
- Pubblicazione automatica su GitHub Pages

## Priorità alta

### Multi-lega
Salvare più aste (Mantra, Classic, stagioni diverse) e passare dall'una all'altra
senza perdere dati. Selettore in alto, duplicazione di una lega come modello,
rinomina ed eliminazione. Richiede di passare da uno stato singolo a una raccolta
di leghe con un id attivo, con migrazione dello stato esistente.

### Export delle rose
- **Excel/CSV** della rosa: nome, squadra, ruoli, prezzo pagato, quotazione, FVM,
  totali per reparto. Un foglio per squadra o un unico foglio con la colonna squadra.
- **Testo formattato** da incollare in chat (WhatsApp/Telegram): rosa compatta per reparto.
- **Immagine** della rosa da condividere.
- Export del **tabellone completo** dell'asta (tutti gli acquisti di tutte le squadre).

### Report di fine asta
Riepilogo automatico: spesa per reparto contro il piano, prezzo medio pagato rispetto
al suggerito, affari e pagati troppo (scostamento dal prezzo suggerito), copertura
squadre di Serie A, confronto della tua rosa con quelle avversarie per FVM totale.

### Cronologia dell'asta
Registro cronologico di ogni chiamata con orario, prezzo e acquirente. Serve per
ricostruire l'andamento, capire chi sta spendendo troppo presto e per l'annullamento
selettivo. Prerequisito per gran parte del reporting sopra.

## Priorità media

### Modalità di chiamata assistita
Un campo "in asta ora" con il giocatore corrente sempre visibile in alto, il tuo
prezzo massimo, quanti avversari possono ancora superarti e un pulsante per
registrare l'assegnazione senza aprire il dialog.

### Allerta budget avversari
Evidenziare quando un avversario non può più superare una certa cifra (perché deve
riempire N slot), così sai quando puoi alzare senza rischio. Il dato c'è già
(offerta massima per squadra), manca il confronto in tempo reale con l'asta corrente.

### Suggerimento prezzo migliorato
Oggi il prezzo suggerito distribuisce i crediti sull'FVM. Possibili affinamenti:
tenere conto dell'inflazione reale dell'asta in corso (quanto si sta pagando sopra
o sotto il suggerito), della scarsità del ruolo e del budget residuo degli avversari.

### Coppie e alternative
Legare più giocatori in un gruppo ("uno di questi tre"), così quando ne prendi uno
gli altri escono automaticamente dagli obiettivi e il budget si libera.

### Vincoli di rosa Mantra
Controllo della fattibilità dei moduli: dato ciò che hai in rosa, quali moduli Mantra
puoi schierare e quali ruoli ti mancano per completarne almeno uno.

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

## Rimandate

- **Logging** delle azioni (l'utente lo ha esplicitamente rimandato)
- **Condivisione e multiutente**: più partecipanti che vedono la stessa asta in tempo
  reale. Richiede un backend, oggi l'app è interamente locale al browser.
