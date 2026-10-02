import { norm } from './nameMatch.ts'
import type { AppState, ClassicRole, Purchase } from './types'

/**
 * Rose in CSV nel formato che fantacalcio.it accetta per il caricamento.
 *
 * Il file e' una sequenza di blocchi, ognuno aperto da `$,$,$` e seguito da una
 * riga `squadra,idGiocatore,prezzo` per giocatore. Nient'altro: niente
 * intestazione, niente nomi, niente ruoli. L'id e' quello del listone, la stessa
 * colonna `Id` da cui l'app importa — per questo le rose costruite qui si
 * ricaricano di la' senza passaggi manuali.
 *
 * Il formato e' stato ricavato da un export vero, byte per byte: fine riga `\n`,
 * nessun BOM, un a capo finale, e il separatore anche prima della prima squadra.
 * Sono dettagli che contano perche' dall'altra parte c'e' un lettore rigido, non
 * un foglio di calcolo.
 *
 * Il modulo sta per conto suo e non tira dentro React: oltre ai tipi importa
 * solo `norm`, la normalizzazione dei nomi, che a sua volta non dipende da
 * nulla. Cosi' il formato si verifica da node, senza la generazione degli Excel.
 */

/** Non e' un'intestazione: compare anche prima della prima squadra. */
const SEPARATORE = '$,$,$'

/**
 * Ordine di lettura di una rosa. Scritto come mappa e non come array perche'
 * TypeScript pretenda che sia completa: un reparto nuovo non passerebbe
 * inosservato.
 */
const ORDINE_REPARTO: Record<ClassicRole, number> = { P: 0, D: 1, C: 2, A: 3 }

export function rosterCsv(state: AppState): string {
  const righe: string[] = []
  const perId = new Map(state.players.map((p) => [p.id, p]))

  for (const team of state.config.teams) {
    const acquisti = state.purchases
      .filter((a) => a.teamId === team.id)
      .flatMap((a) => {
        const player = perId.get(a.playerId)
        // Un acquisto che non trova il giocatore nel listone non ha un id da
        // scrivere: saltarlo e' meglio che produrre una riga che l'altro capo
        // non sa leggere.
        return player ? [{ prezzo: a.price, player }] : []
      })
      .sort((a, b) => {
        const dr = ORDINE_REPARTO[a.player.r] - ORDINE_REPARTO[b.player.r]
        return dr !== 0 ? dr : b.prezzo - a.prezzo
      })

    // Una squadra senza acquisti non ha un blocco: un separatore seguito dal
    // nulla e' un blocco vuoto, e non si sa mai come lo prende chi legge.
    if (acquisti.length === 0) continue

    righe.push(SEPARATORE)
    for (const { prezzo, player } of acquisti) {
      righe.push(`${nomeCsv(team.name)},${player.id},${prezzo}`)
    }
  }

  return righe.length ? righe.join('\n') + '\n' : ''
}

/**
 * Il formato non prevede virgolette, quindi una virgola nel nome squadra
 * spezzerebbe la riga in quattro campi. Si toglie, invece di sperare che il
 * lettore dall'altra parte sia piu' furbo di cosi'.
 */
function nomeCsv(nome: string): string {
  const pulito = nome.replace(/[,\r\n]+/g, ' ').replace(/\s+/g, ' ').trim()
  return pulito || 'Squadra'
}

// ------------------------------------------------- lettura: l'altro verso ---

/**
 * Lo stesso formato, letto al contrario, per partire da rose che esistono gia':
 * quelle dell'anno scorso, o quelle di un'altra lega.
 *
 * In scrittura il formato e' rigido perche' dall'altra parte c'e' un lettore
 * rigido. In lettura conviene l'opposto: il file puo' arrivare dall'export del
 * sito, da un foglio di calcolo o da una chat, e un BOM, un `\r\n` o una riga
 * d'intestazione non sono motivi per buttare via tutto il resto.
 */
export interface RigaRosaCsv {
  /** Nome squadra come sta scritto nel file */
  nomeSquadra: string
  giocatoreId: number
  prezzo: number
}

export interface LetturaRoseCsv {
  /** Righe interpretabili, nell'ordine del file */
  righe: RigaRosaCsv[]
  /** Nomi squadra distinti, nell'ordine in cui compaiono */
  nomiSquadra: string[]
  /** Righe che non sono ne' un separatore ne' una rosa: si contano e si dicono */
  ignorate: number
}

export function leggiRoseCsv(testo: string): LetturaRoseCsv {
  const righe: RigaRosaCsv[] = []
  const nomiSquadra: string[] = []
  let ignorate = 0

  for (const grezza of testo.replace(/^﻿/, '').split(/\r?\n/)) {
    const riga = grezza.trim()
    if (!riga || riga === SEPARATORE) continue

    const campi = riga.split(',')
    const nome = campi[0]?.trim() ?? ''
    const id = Number(campi[1]?.trim())
    const prezzo = Number(campi[2]?.trim())
    // Tre campi, un id intero e un prezzo: l'intestazione di un foglio di
    // calcolo cade qui da sola, perche' "idGiocatore" non e' un numero.
    if (campi.length !== 3 || !nome || !Number.isInteger(id) || id <= 0 || !Number.isFinite(prezzo)) {
      ignorate++
      continue
    }

    if (!nomiSquadra.includes(nome)) nomiSquadra.push(nome)
    // Stesso arrotondamento degli acquisti registrati a mano: un prezzo a zero
    // o negativo non esiste in un'asta.
    righe.push({ nomeSquadra: nome, giocatoreId: id, prezzo: Math.max(1, Math.round(prezzo)) })
  }

  return { righe, nomiSquadra, ignorate }
}

export interface AbbinamentoRose {
  /** Acquisti pronti per il riduttore, nell'ordine del file */
  acquisti: { playerId: number; teamId: string; price: number }[]
  /** Nome nel file -> id squadra dell'asta, per quelle riconosciute */
  mappa: Record<string, string>
  /** Nomi del file che non corrispondono a nessuna squadra */
  squadreIgnote: string[]
  /** Id che non stanno nel listone importato: senza giocatore non c'e' acquisto */
  fuoriListone: number[]
  /** Id ripetuti nel file: vale la prima riga, la seconda si segnala */
  doppioni: number[]
  /** Quanti dei riconosciuti sono nel foglio Ceduti: in rosa ma inutilizzabili */
  ceduti: number
}

/**
 * Collega un file letto all'asta aperta: le squadre per nome, i giocatori per
 * id del listone.
 *
 * `scelte` sovrascrive il riconoscimento per nome, una voce per nome del file.
 * Serve perche' le rose di un'altra lega hanno altri nomi di squadra, e
 * indovinare l'accoppiamento dall'ordine di apparizione significherebbe
 * assegnare una rosa intera alla persona sbagliata senza dirlo. Una stringa
 * vuota esclude quel blocco.
 */
export function abbinaRose(
  lettura: LetturaRoseCsv,
  state: AppState,
  scelte: Record<string, string> = {},
): AbbinamentoRose {
  const perNome = new Map<string, string>()
  for (const t of state.config.teams) {
    const chiave = norm(t.name)
    if (chiave && !perNome.has(chiave)) perNome.set(chiave, t.id)
  }
  const idValidi = new Set(state.config.teams.map((t) => t.id))

  const mappa: Record<string, string> = {}
  const squadreIgnote: string[] = []
  for (const nome of lettura.nomiSquadra) {
    const scelta = scelte[nome]
    // Una scelta esplicita vince sul nome, compresa quella di lasciar fuori il blocco
    const id = scelta !== undefined ? (idValidi.has(scelta) ? scelta : '') : perNome.get(norm(nome))
    if (id) mappa[nome] = id
    else if (scelta === undefined) squadreIgnote.push(nome)
  }

  const perId = new Map(state.players.map((p) => [p.id, p]))
  const acquisti: AbbinamentoRose['acquisti'] = []
  const visti = new Set<number>()
  const fuoriListone: number[] = []
  const doppioni: number[] = []
  let ceduti = 0

  for (const riga of lettura.righe) {
    const teamId = mappa[riga.nomeSquadra]
    if (!teamId) continue
    const player = perId.get(riga.giocatoreId)
    if (!player) {
      if (!fuoriListone.includes(riga.giocatoreId)) fuoriListone.push(riga.giocatoreId)
      continue
    }
    if (visti.has(riga.giocatoreId)) {
      doppioni.push(riga.giocatoreId)
      continue
    }
    visti.add(riga.giocatoreId)
    if (player.ceduto) ceduti++
    acquisti.push({ playerId: riga.giocatoreId, teamId, price: riga.prezzo })
  }

  return { acquisti, mappa, squadreIgnote, fuoriListone, doppioni, ceduti }
}

/**
 * Unisce le rose lette agli acquisti gia' registrati.
 *
 * `sostituisci` serve quando il file *e'* la situazione di partenza: si carica
 * per avere quella, non per sommarla a quello che c'era. Altrimenti si aggiunge,
 * e chi era gia' in rosa cambia squadra e prezzo ma conserva il suo orario:
 * quello di un'asta vera vale piu' di quello inventato per un file.
 */
export function fondiAcquisti(
  esistenti: Purchase[],
  importati: Purchase[],
  sostituisci: boolean,
): Purchase[] {
  if (sostituisci) return importati
  const perId = new Map(esistenti.map((p) => [p.playerId, p]))
  for (const a of importati) {
    const attuale = perId.get(a.playerId)
    perId.set(a.playerId, attuale ? { ...a, ts: attuale.ts } : a)
  }
  return [...perId.values()]
}
