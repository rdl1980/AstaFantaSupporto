import type { AppState, ClassicRole } from './types'

/**
 * Quanto la stanza sta pagando sopra o sotto il prezzo suggerito, mentre l'asta
 * e' ancora in corso.
 *
 * Il prezzo suggerito distribuisce i crediti sull'FVM: e' una misura di *valore*,
 * non di *mercato*. Il mercato lo fanno le otto persone sedute al tavolo, e nelle
 * prime chiamate si capisce subito se stanno tirando o tenendosi stretti i
 * crediti. Sapere di quanto serve a ritarare i propri massimi a meta' strada,
 * invece di scoprire alla fine di aver comprato tutto caro — o di essere rimasti
 * con novecento crediti in mano e la rosa da completare.
 *
 * Si guarda il rapporto fra totale pagato e totale suggerito, non la media degli
 * scostamenti: un portiere da 1 credito pagato 3 triplicherebbe la media pur
 * spostando il mercato di due crediti.
 */

/** Sotto questa soglia il numero e' rumore e non si mostra. */
export const CAMPIONE_MINIMO = 8

export interface QuotaInflazione {
  /** 0.18 = si sta pagando il 18% in piu' del suggerito. null se il campione e' troppo magro */
  scostamento: number | null
  campione: number
  pagato: number
  atteso: number
}

export interface Inflazione extends QuotaInflazione {
  perReparto: Record<ClassicRole, QuotaInflazione>
}

function quota(pagato: number, atteso: number, campione: number, minimo: number): QuotaInflazione {
  const abbastanza = campione >= minimo && atteso > 0
  return { scostamento: abbastanza ? pagato / atteso - 1 : null, campione, pagato, atteso }
}

export function inflazione(state: AppState, suggerimenti: Map<number, number>, minimo = CAMPIONE_MINIMO): Inflazione {
  const perId = new Map(state.players.map((p) => [p.id, p]))
  const vuoto = () => ({ pagato: 0, atteso: 0, campione: 0 })
  const reparti: Record<ClassicRole, { pagato: number; atteso: number; campione: number }> = {
    P: vuoto(), D: vuoto(), C: vuoto(), A: vuoto(),
  }
  let pagato = 0
  let atteso = 0
  let campione = 0

  for (const acquisto of state.purchases) {
    const player = perId.get(acquisto.playerId)
    const suggerito = suggerimenti.get(acquisto.playerId) ?? 0
    // Un giocatore senza suggerito non dice nulla sul mercato: entrarci dentro
    // gonfierebbe lo scostamento con un confronto che non esiste.
    if (!player || suggerito <= 0) continue
    pagato += acquisto.price
    atteso += suggerito
    campione++
    const r = reparti[player.r]
    r.pagato += acquisto.price
    r.atteso += suggerito
    r.campione++
  }

  return {
    ...quota(pagato, atteso, campione, minimo),
    perReparto: {
      P: quota(reparti.P.pagato, reparti.P.atteso, reparti.P.campione, minimo),
      D: quota(reparti.D.pagato, reparti.D.atteso, reparti.D.campione, minimo),
      C: quota(reparti.C.pagato, reparti.C.atteso, reparti.C.campione, minimo),
      A: quota(reparti.A.pagato, reparti.A.atteso, reparti.A.campione, minimo),
    },
  }
}

/**
 * Il suggerito corretto per come sta andando questa asta.
 *
 * Si usa lo scostamento del reparto quando ha abbastanza acquisti alle spalle,
 * perche' i portieri e gli attaccanti non si gonfiano allo stesso modo; altrimenti
 * si ripiega su quello generale. Senza ne' l'uno ne' l'altro si restituisce il
 * suggerito com'e': meglio nessuna correzione di una inventata su tre acquisti.
 */
export function ritara(suggerito: number, infl: Inflazione, ruolo: ClassicRole): number {
  const scostamento = infl.perReparto[ruolo].scostamento ?? infl.scostamento
  if (scostamento === null) return suggerito
  return Math.max(1, Math.round(suggerito * (1 + scostamento)))
}

/** "+18%" / "−7%" / "—" */
export function etichettaInflazione(scostamento: number | null): string {
  if (scostamento === null) return '—'
  const perCento = Math.round(scostamento * 100)
  return `${perCento > 0 ? '+' : perCento < 0 ? '−' : ''}${Math.abs(perCento)}%`
}
