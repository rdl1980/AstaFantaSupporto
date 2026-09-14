import type { AppState, ClassicRole, Player } from './types'

/**
 * Asta a sorteggio: invece di chiamare i giocatori a turno, li estrae l'app.
 *
 * Due modi. **Lista completa**: si pesca da tutto il listone, e l'asta va avanti
 * finche' i giocatori finiscono. **Per reparto**: si pesca solo fra portieri, o
 * difensori, o centrocampisti, o attaccanti — il modo in cui molte leghe fanno
 * l'asta, un reparto alla volta.
 *
 * Anche in Mantra il reparto e' quello Classic (P/D/C/A): i ruoli Mantra sono
 * undici e un giocatore ne ha piu' d'uno, quindi non dividono il listone in
 * gruppi netti. Per pescare serve una partizione, e l'unica che ce l'ha e'
 * quella dei reparti.
 */
export type AmbitoSorteggio = 'tutti' | 'ruolo'

export interface OpzioniSorteggio {
  ambito: AmbitoSorteggio
  /** Reparto da cui pescare quando l'ambito e' 'ruolo' */
  ruolo?: ClassicRole | null
  /**
   * Gia' usciti ma non assegnati. Restano fuori dal mazzo, altrimenti un
   * giocatore che nessuno ha voluto continuerebbe a ripresentarsi.
   */
  esclusi?: ReadonlySet<number>
  /** Iniettabile: senza, il sorteggio non sarebbe verificabile */
  caso?: () => number
}

export interface EsitoSorteggio {
  player: Player | null
  /** Il mazzo era esaurito e si e' ripartiti dagli scartati */
  rimescolato: boolean
  /**
   * Quanti restano nel mazzo dopo questa estrazione. Non e' il numero di
   * giocatori liberi nel reparto: sono quelli che non sono ancora usciti, che
   * e' la cifra che serve mentre si pesca per sapere quanto manca alla fine del
   * giro.
   */
  rimasti: number
}

/** Giocatori ancora chiamabili nell'ambito scelto, ignorando gli scarti. */
export function chiamabili(state: AppState, opzioni: OpzioniSorteggio): Player[] {
  const presi = new Set(state.purchases.map((p) => p.playerId))
  return state.players.filter(
    (p) =>
      !p.ceduto &&
      !presi.has(p.id) &&
      (opzioni.ambito === 'tutti' || !opzioni.ruolo || p.r === opzioni.ruolo),
  )
}

/**
 * Estrae il prossimo giocatore da mettere in asta.
 *
 * Quando gli scarti hanno svuotato il mazzo si rimescola invece di rispondere
 * "finito": a meta' asta restano quasi solo giocatori che nessuno aveva voluto
 * al primo giro, e sono proprio quelli che vanno ancora assegnati.
 */
export function sorteggia(state: AppState, opzioni: OpzioniSorteggio): EsitoSorteggio {
  const caso = opzioni.caso ?? Math.random
  const tutti = chiamabili(state, opzioni)
  if (tutti.length === 0) return { player: null, rimescolato: false, rimasti: 0 }

  const esclusi = opzioni.esclusi ?? new Set<number>()
  const mazzo = tutti.filter((p) => !esclusi.has(p.id))
  const rimescolato = mazzo.length === 0
  const da = rimescolato ? tutti : mazzo

  const i = Math.min(da.length - 1, Math.max(0, Math.floor(caso() * da.length)))
  return { player: da[i], rimescolato, rimasti: da.length - 1 }
}
