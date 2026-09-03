import { useEffect, useRef, useState } from 'react'
import type { ChiamataRow } from './types'

export interface EsitoChiamata {
  giocatore: string
  prezzo: number
  /** Il nome lo risolve chi mostra l'esito, con l'elenco che ha gia' sotto mano */
  squadraId: string
  /** Istante in cui smettere di mostrarlo */
  fino: number
}

/**
 * Trattiene per qualche secondo l'esito della chiamata appena chiusa.
 *
 * Appena il giocatore viene aggiudicato il server riporta la chiamata a vuoto,
 * e senza questo la schermata salterebbe di colpo a "nessun giocatore in asta":
 * nessuno farebbe in tempo a leggere chi se l'è preso e a quanto. L'attesa è
 * solo di facciata, sul singolo dispositivo: l'asta è già andata avanti.
 */
export function useEsitoRecente(chiamata: ChiamataRow | null, durataMs = 3000): EsitoChiamata | null {
  const [esito, setEsito] = useState<EsitoChiamata | null>(null)
  const precedente = useRef<ChiamataRow | null>(null)

  // Cattura: dipende solo dalla chiamata, cioè da ciò che davvero cambia fase
  useEffect(() => {
    const prima = precedente.current
    precedente.current = chiamata

    const eraAttiva = prima?.stato === 'active' && !!prima.giocatore_nome
    const oraFinita = !chiamata || chiamata.stato !== 'active' || !chiamata.giocatore_id
    // Una chiamata annullata senza offerte non ha un esito da mostrare
    if (!eraAttiva || !oraFinita || !prima?.miglior_offerente_id || prima.offerta_attuale == null) {
      return
    }

    setEsito({
      giocatore: prima.giocatore_nome!,
      prezzo: prima.offerta_attuale,
      squadraId: prima.miglior_offerente_id,
      fino: Date.now() + durataMs,
    })
  }, [chiamata, durataMs])

  // Scadenza: effetto separato, altrimenti un semplice ri-render annullerebbe il
  // timer senza riarmarlo e l'esito resterebbe a schermo per sempre.
  useEffect(() => {
    if (!esito) return
    const t = setTimeout(() => setEsito(null), Math.max(0, esito.fino - Date.now()))
    return () => clearTimeout(t)
  }, [esito])

  return esito
}
