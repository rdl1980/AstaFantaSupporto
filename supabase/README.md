# Asta live — come si mette in piedi

Serve un progetto Supabase sul piano gratuito. Tutto quello che segue si fa una
volta sola, e va fatto **con calma qualche giorno prima dell'asta**, non la sera
stessa.

## 1. Creare il progetto

Su [supabase.com](https://supabase.com) crea un nuovo progetto. Regione: Europa,
per avere meno latenza. Annota la password del database, anche se qui non serve.

## 2. Eseguire gli script

Dal menu **SQL Editor**, esegui i tre file **in ordine**, uno alla volta:

1. `01-schema.sql` — le tabelle
2. `02-functions.sql` — le funzioni: creazione sessione, chiamata, rilancio, aggiudicazione
3. `03-policies.sql` — i permessi e la pubblicazione realtime

Se `03` si lamenta perché una tabella è già nella publication, va bene: significa
che era già pubblicata.

## 3. Copiare le credenziali

In **Project Settings → API** trovi:

- **Project URL** → `VITE_SUPABASE_URL`
- **anon public** key → `VITE_SUPABASE_ANON_KEY`

Per lo sviluppo in locale, crea un file `.env` nella radice del progetto:

```
VITE_SUPABASE_URL=https://xxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOi...
```

Per il sito pubblicato su GitHub Pages, aggiungi gli stessi due valori in
**Settings → Secrets and variables → Actions → New repository secret**, con gli
stessi nomi. Senza, l'app si costruisce lo stesso e la parte live resta spenta:
tutto il resto continua a funzionare.

La chiave `anon` finisce dentro il bundle pubblico ed è **progettata per essere
visibile**. Quello che protegge i dati sono le policy e le funzioni, non il
segreto della chiave. La chiave `service_role`, invece, non va messa da nessuna
parte in questo progetto.

## 4. Provare

```bash
npm run dev
```

Nella schermata d'asta compare la barra live con **Avvia sessione live**. Da lì
ottieni un codice stanza e il link da mandare ai partecipanti, nella forma
`…/?asta=CODICE`.

## Verifiche automatiche

Le funzioni SQL sono collaudate su Postgres in WASM, senza bisogno di un database
installato:

```bash
npm test
```

Esegue lo schema reale, prova le regole del rilancio (crediti, slot di ruolo,
rilancio minimo, scadenza, autorizzazioni) e verifica che i token non siano
leggibili dalle tabelle che il client interroga.

## Collaudo contro il progetto vero

Con il `.env` configurato:

```bash
npm run test:live
```

Crea una sessione chiamata "PROVA AUTOMATICA" e verifica sul database reale: creazione,
rivendica delle squadre, chiamata, rilanci validi e rifiutati, **offerte simultanee**
(tre offerte identiche partite insieme: ne deve passare una sola), aggiudicazione,
consegna degli eventi realtime e il fatto che i token non siano leggibili con la chiave
anon. Lascia dietro di sé qualche sessione di prova, innocua.

Misure raccolte sul progetto reale: rilancio accettato in circa **95 ms**, propagazione
agli altri dispositivi con mediana **circa 300 ms**. Più dei 200 ms teorici, ma in
un'asta il conteggio va a secondi: chi rilancia riceve comunque la conferma in un
decimo di secondo.

## Attenzione ai progetti gratuiti in pausa

Un progetto Supabase gratuito viene messo in pausa dopo un periodo di inattività
e va risvegliato dalla dashboard. **Aprilo il giorno prima dell'asta** e fai una
prova vera: creare una sessione e collegare un telefono.

## Ripartire da zero

Per svuotare tutto e ricominciare:

```sql
drop table if exists squadra_segreto, sessione_segreto, chiamata,
                     assegnazione, squadra, sessione cascade;
```

Poi riesegui i tre script.
