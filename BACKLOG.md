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

## Priorità alta

### Avviso di sforamento del budget
Oggi si può registrare un acquisto che porta il residuo sotto zero (utile se ci si
sbaglia a digitare: 650 al posto di 65). Un avviso nel dialog di acquisto, senza
bloccare, intercetterebbe l'errore di battitura sul momento.

### Immagine della rosa
Export della rosa come immagine da condividere, oltre al testo e all'Excel già presenti.

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

## Rimandate

- **Logging** delle azioni (l'utente lo ha esplicitamente rimandato)
- **Condivisione e multiutente**: più partecipanti che vedono la stessa asta in tempo
  reale. Richiede un backend, oggi l'app è interamente locale al browser.
