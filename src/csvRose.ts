import type { AppState, ClassicRole } from './types'

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
 * Il modulo sta per conto suo e importa solo tipi: cosi' il formato si puo'
 * verificare senza tirarsi dietro la generazione degli Excel.
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
