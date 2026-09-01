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

## Dove finiscono i dati

Tutto è salvato nel `localStorage` del browser, sotto la chiave `asta-fanta-state-v1`:
configurazione della lega, listone importato, acquisti e obiettivi. Nessun server, nessun
account. Il `localStorage` è separato per indirizzo: i dati su `localhost:5173` e quelli
sulla versione pubblicata su GitHub Pages sono due archivi distinti. Per spostarli usa
**⬇ Backup** e **⬆ Ripristina** dalla barra in alto.

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
