# Asta Live Sincronizzata — progettazione

> **Stato: realizzata.** Entrambe le fasi sono implementate. Lo schema e le funzioni sono
> in [`supabase/`](supabase/), la messa in piedi in [supabase/README.md](supabase/README.md).
> Restano da fare la prova con dispositivi veri e le decisioni aperte del §14.
>
> Due scelte sono cambiate rispetto alla prima stesura, ed è spiegato dove: i token non
> stanno più nelle tabelle leggibili (§6) e il conteggio è derivato dalla scadenza (§7).

Documento di lavoro per portare l'app da strumento locale a sessione d'asta condivisa.
Nasce da una specifica scritta per un'applicazione diversa (con backend e database già
esistenti): qui è riadattata a ciò che il progetto è davvero.

## 1. Punto di partenza

L'app oggi è un SPA React 19 + TypeScript, tre dipendenze, **nessuna chiamata di rete**,
tutto lo stato nel `localStorage`, pubblicata come file statici su GitHub Pages.

Non esistono: un backend, un database, account utente, un layout mobile (zero media query).
Le "squadre" sono etichette in una configurazione locale — `{ id, name, isMine }` — senza
alcuna nozione di identità.

Di conseguenza, ciò che la specifica chiama *integrazione* è **costruzione da zero**. Le
tabelle `Utenti`, `Calciatori`, `Leghe`, `Rose` citate nella specifica non esistono.

## 2. Vincoli

- **Tutto su piano gratuito.** Account disponibili: Supabase, Firebase, Vercel.
- **Si punta alla Classic della prossima settimana** — realistico solo per la Fase 1
  (vedi §4). L'asta con rilanci non ha i tempi per una prova generale seria.
- Il client resta statico: GitHub Pages continua a funzionare, non serve spostare l'hosting.

## 3. Scelta dello stack: Supabase

Il vincolo "gratis" decide la questione, ed è bene esplicitare perché.

La parte difficile non è il trasporto in tempo reale, è la **validazione del rilancio**:
crediti residui, slot di ruolo, rilancio minimo, tutto sotto concorrenza. Su Supabase questo
è una **funzione Postgres** chiamata via RPC che lavora sotto lock di riga: le richieste
simultanee si accodano sul lock, la prima vince, la seconda riceve "offerta superata". È
letteralmente la coda FIFO richiesta dalla specifica, ottenuta dal database invece che da
codice di server da scrivere e debuggare. Ed è inclusa nel piano gratuito.

Su Firebase la stessa logica richiederebbe le Cloud Functions, che stanno sul piano Blaze
con carta di credito registrata. Le security rules da sole non sanno esprimere bene "questa
squadra ha già 8 difensori".

Il realtime arriva dalle sottoscrizioni ai cambi di riga: nessun gateway WebSocket da
gestire, nessun server da tenere sveglio.

**Limiti del piano gratuito da tenere presenti** (verificare i valori aggiornati prima di
fare affidamento): per 8 partecipanti spazio, connessioni e messaggi sono abbondantemente
sufficienti. La cosa che punge davvero è che **i progetti gratuiti vanno in pausa dopo un
periodo di inattività**: va risvegliato e verificato il giorno prima dell'asta, non la sera
stessa.

## 4. Piano in due fasi

La divisione non è burocratica: la Fase 1 fa quasi tutto il lavoro utile senza assumersi la
responsabilità di decidere l'asta.

### Fase 1 — Tabellone condiviso (obiettivo: Classic)

Il banditore registra gli acquisti **esattamente come fa oggi**. Gli altri, dal telefono,
vedono in diretta: giocatore in chiamata, chi ha preso cosa e a quanto, budget residui e
slot di ogni squadra. I rilanci restano dove sono adesso (a voce, o sul sito ufficiale).

**Principio di sicurezza, non negoziabile:** l'app locale del banditore resta la fonte di
verità. La pubblicazione verso Supabase è un *riflesso* dello stato locale, con coda di
ritentativi. Se la rete cade o Supabase non risponde, compare un indicatore "non
sincronizzato" e **l'asta prosegue senza intoppi**, esattamente come oggi. Un guasto della
parte live non può rovinare la serata.

### Fase 2 — Rilanci dai telefoni (dopo la Classic)

Aggiunge la chiamata con timer, i rilanci validati lato server e l'assegnazione al miglior
offerente. È la parte che rende l'app responsabile della correttezza dell'asta, e per questo
va rilasciata solo dopo una prova generale con dispositivi veri.

## 5. Modello dati

### Fase 1

Tabelle `sessione`, `squadra`, `assegnazione`, più `sessione_segreto` e `squadra_segreto` per
i token (vedi §6). Lo schema autorevole è [`supabase/01-schema.sql`](supabase/01-schema.sql):
qui basta ricordare due scelte.

**I dati del giocatore sono denormalizzati** in `assegnazione` — nome, club e ruoli copiati
accanto all'id. I telefoni dei partecipanti non hanno il listone: salvando solo l'id, ognuno
dovrebbe importare lo stesso Excel per leggere un nome.

**La configurazione della lega viaggia nella sessione** (`budget`, `slot_config`,
`rilancio_minimo`, `attesa_secondi`, `intervallo_secondi`), così il server può validare i
rilanci senza fidarsi di quello che dichiara il client.

### Fase 2

Una sola tabella `chiamata`, con **una sola riga per sessione**: il giocatore in asta,
l'offerta corrente, il miglior offerente e la scadenza.

Quella riga è anche il punto su cui si serializzano i rilanci: è lì che si prende il lock.

## 6. Identità e sicurezza

Non servono account veri. Il flusso:

1. Il banditore crea la sessione e ottiene un **codice stanza** e un `admin_token`.
2. Condivide un link con il codice: `…/AstaFantaSupporto/?asta=CLASSIC-7K3Q`.
3. Chi apre il link **rivendica una squadra** dall'elenco e riceve un `claim_token` salvato
   nel proprio `localStorage`. Da quel momento quella squadra è sua.

**Correzione rispetto alla prima stesura.** I token non abitano nelle tabelle che il client
legge: `admin_token` e `claim_token` stanno in `sessione_segreto` e `squadra_segreto`, su cui
RLS è attiva e non esiste alcuna policy, quindi sono irraggiungibili dal client. La tabella
`squadra` espone solo un flag `presa`. Il motivo è duplice: la lettura è aperta a chi conosce
il codice stanza, e soprattutto **le notifiche realtime spediscono la riga intera** a tutti i
sottoscrittori — un token dentro `squadra` sarebbe finito nel telefono di ogni partecipante.

**Da dire comunque chiaramente:** in un'architettura solo-client la chiave pubblica di
Supabase è dentro il bundle, quindi è visibile. La protezione viene dalle policy RLS e dalla funzione
di rilancio, non dal nascondere la chiave. Per una lega privata tra amici è adeguato: chi
conoscesse il codice stanza potrebbe disturbare, ma il banditore può sempre correggere lo
stato e rigenerare il codice. **Non è un sistema a prova di malintenzionato**, ed è giusto
saperlo invece di scoprirlo.

Le policy RLS in sintesi:

- lettura di `sessione`, `squadra`, `assegnazione`: consentita a chi conosce il codice;
- scrittura di `assegnazione` e `chiamata`: **solo** tramite funzioni `security definer`,
  mai direttamente dal client;
- rivendicazione di una squadra: consentita una sola volta, finché `claim_token` è nullo.

## 7. Il conteggio, e perché non viaggia sulla rete

Il server trasmette **un solo dato temporale**: l'istante di scadenza della chiamata. Ogni
dispositivo ricava da sé la fase — attesa, uno, due, tre — dalla scadenza e dai due parametri
configurati. Non c'è nessun flusso di tick da mantenere sincronizzato, chi si riconnette a
metà conteggio si riallinea da solo, e tutti vedono lo stesso numero nello stesso momento.

I due tempi sono configurabili per lega: `attesa_secondi` (dall'ultima offerta all'inizio del
conteggio) e `intervallo_secondi` (fra un numero e il successivo). Una chiamata senza rilanci
dura quindi `attesa + 3 × intervallo`, e ogni rilancio la fa ripartire da capo.

Resta un problema che il calcolo locale porta con sé: **l'orologio del dispositivo**. Un
telefono indietro di dieci secondi mostrerebbe un conteggio sfasato e continuerebbe a
rilanciare a chiamata chiusa. Per questo all'avvio si misura lo scarto rispetto a `ora_server()`
e lo si applica a ogni calcolo. La decisione di accettare o rifiutare resta comunque del
server, che usa il proprio `now()`.

La logica è in [`src/live/countdown.ts`](src/live/countdown.ts), con i test in
[`test/countdown.mjs`](test/countdown.mjs).

## 8. Eventi e payload

Con Supabase gli "eventi" non sono messaggi custom: sono cambi di riga sottoscritti dal
client. È meno codice e un punto in meno dove sbagliare.

**Dal server ai client** (sottoscrizioni `postgres_changes` filtrate su `sessione_id`):

| Sorgente | Evento | Contenuto | Chi lo usa |
|---|---|---|---|
| `assegnazione` | INSERT | riga completa | tutti: aggiorna il tabellone |
| `assegnazione` | DELETE | id | tutti: annullamento di un acquisto |
| `chiamata` | UPDATE | riga completa | tutti: giocatore in asta, offerta, scadenza |
| `sessione` | UPDATE | `stato` | tutti: pausa, chiusura |

**Dai client al server** (chiamate RPC, non messaggi):

```ts
// Fase 1 — solo il banditore
rpc('pubblica_assegnazione', { p_sessione, p_admin_token, p_giocatore, p_squadra, p_prezzo })
rpc('rimuovi_assegnazione',  { p_sessione, p_admin_token, p_giocatore_id })

// Fase 2
rpc('metti_all_asta', { p_sessione, p_admin_token, p_giocatore, p_secondi })
rpc('rilancia',       { p_sessione, p_squadra, p_claim_token, p_offerta })
rpc('assegna',        { p_sessione, p_admin_token })
rpc('annulla_chiamata',{ p_sessione, p_admin_token })
```

Risposta di `rilancia`:

```jsonc
{ "ok": true,  "offerta": 145, "versione": 87 }
{ "ok": false, "motivo": "offerta_superata",   "offerta_attuale": 150, "versione": 88 }
{ "ok": false, "motivo": "crediti_insufficienti", "massimo": 132 }
{ "ok": false, "motivo": "slot_ruolo_pieni",   "ruolo": "D" }
{ "ok": false, "motivo": "chiamata_scaduta" }
```

## 9. La funzione di rilancio (cuore della Fase 2)

```sql
create or replace function rilancia(
  p_sessione uuid, p_squadra uuid, p_claim_token text, p_offerta int
) returns jsonb
language plpgsql security definer as $$
declare c chiamata%rowtype; ...
begin
  -- Il lock di riga è la coda: i rilanci simultanei si accodano qui e
  -- vengono processati uno alla volta, in ordine di arrivo.
  select * into c from chiamata where sessione_id = p_sessione for update;

  -- 1. token della squadra valido
  -- 2. stato = 'active' e now() < scadenza
  -- 3. p_offerta >= coalesce(offerta_attuale, 0) + rilancio_minimo
  -- 4. p_offerta <= crediti residui - (slot ancora da riempire - 1)
  -- 5. slot del ruolo del giocatore non già pieni
  -- se tutto passa: update chiamata ... versione = versione + 1
end $$;
```

Le condizioni 4 e 5 replicano lato server la logica che il client ha già in
[`src/store.tsx`](src/store.tsx) (`maxBidFor`, `teamStats`): **la stessa regola scritta due
volte**, in TypeScript per l'interfaccia e in SQL per la validazione. È una duplicazione
consapevole — il client non può essere creduto sulla parola — ma va tenuta allineata, ed è
il punto più probabile di divergenza futura.

## 10. Impatto sul client esistente

Nuovi file, isolati in `src/live/`:

- `client.ts` — istanza Supabase, letta da `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`;
- `session.ts` — creazione sessione, rivendicazione squadra, sottoscrizioni;
- `publisher.ts` — coda di pubblicazione con ritentativi (Fase 1);
- `ParticipantScreen.tsx` — la schermata del partecipante.

Cosa **non** cambia: listone, obiettivi, moduli, scarsità, report e il modello a più aste
restano locali e identici. La sessione live è un livello che si affianca, non sostituisce.

Nel repo servono due variabili d'ambiente anche nel workflow di GitHub Actions, altrimenti
la build pubblicata non sa a quale progetto Supabase parlare.

## 11. Interfaccia del partecipante

Va **scritta mobile-first come schermata a sé**, non adattata dal layout a due colonne del
banditore: sarebbe più lavoro e verrebbe peggio. Contenuto essenziale, leggibile con una
mano e a distanza di braccio:

- in alto: giocatore in chiamata, offerta attuale, chi la detiene;
- al centro: i propri crediti residui e gli slot mancanti per ruolo;
- in basso (Fase 2): pulsante grande **+1** e campo per l'offerta libera;
- accesso secondario al tabellone completo di tutte le squadre.

## 12. Rischi e prova generale

| Rischio | Mitigazione |
|---|---|
| Progetto Supabase in pausa | Risveglio e verifica il giorno prima |
| Rete che cade a metà asta | Fase 1: la sincronizzazione è un riflesso, l'asta locale non si ferma |
| Telefono che si disconnette | Alla riconnessione si rilegge lo stato completo, non si applicano differenze |
| Due rilanci identici | Lock di riga: uno vince, l'altro riceve `offerta_superata` |
| Divergenza fra regole TS e SQL | Test che confrontano le due implementazioni sugli stessi casi |

Prima di usarla in un'asta vera serve una **prova con almeno tre dispositivi reali**,
provocando disconnessioni e rilanci simultanei. Senza quella prova la Fase 2 non va usata.

## 13. Stima

| | Lavoro | Realistico per la Classic |
|---|---|---|
| Fase 1 | schema, pubblicazione con ritentativi, schermata partecipante, prova | **Sì**, se si parte subito |
| Fase 2 | chiamata, timer, funzione di rilancio, UI offerte, prova generale | No: serve tempo per provarla sul serio |

## 14. Decisioni ancora aperte

1. Il timer di fine chiamata lo decide il banditore a mano o scade da solo? (Automatico
   significa che il server deve valutare la scadenza: si fa dentro `rilancia` e `assegna`,
   senza processi schedulati.)
2. Il rilancio minimo è sempre 1 credito o configurabile per lega?
3. I partecipanti devono poter vedere gli obiettivi altrui? (Direi di no.)
4. A fine asta ognuno si porta a casa la propria rosa nella sua app locale? Sarebbe il
   naturale ricongiungimento fra la parte live e il resto dell'app.
