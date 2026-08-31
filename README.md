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
   - **La mia rosa**: raggruppata per ruolo; in Mantra i multiruolo appaiono in tutte le loro caselle.
   - **Squadre**: budget residuo, slot e rosa di tutti i partecipanti.
   - **Obiettivi**: lista dei preferiti con prezzo massimo e note.
   - **Annulla ultimo**, **Backup/Ripristina** (JSON) dalla barra in alto.

## Prezzo suggerito

Distribuisce tutti i crediti della lega (budget × squadre) sul pool dei migliori N giocatori
disponibili (N = slot totali × squadre), proporzionalmente all'FVM della modalità attiva.
È indicativo e si ricalibra automaticamente su budget e dimensione della lega.

## Stack

Vite + React + TypeScript, [SheetJS](https://sheetjs.com/) per il parsing Excel. Nessuna altra dipendenza.
