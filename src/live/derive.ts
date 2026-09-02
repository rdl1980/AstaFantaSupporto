import type { AssegnazioneRow, SessioneRow } from './types'

/**
 * Ricalcola lato client le stesse quantità che il server verifica in
 * `_offerta_massima` e `_slot_ruolo_pieno`. Serve solo per mostrare l'interfaccia
 * giusta e disabilitare i pulsanti: **la decisione resta del server**, che
 * rifiuta comunque un rilancio non valido.
 */

export interface StatoSquadra {
  spesi: number
  residui: number
  presi: number
  slotTotali: number
  slotRimasti: number
  /** Massimo offribile lasciando un credito per ogni altro slot da riempire */
  maxOfferta: number
  perRuolo: Record<string, number>
}

export function slotTotali(s: SessioneRow): number {
  if (s.modalita === 'mantra') {
    return (s.slot_config.portieri ?? 0) + (s.slot_config.movimento ?? 0)
  }
  const slot = s.slot_config.slot ?? {}
  return (slot.P ?? 0) + (slot.D ?? 0) + (slot.C ?? 0) + (slot.A ?? 0)
}

export function statoSquadra(
  s: SessioneRow,
  assegnazioni: AssegnazioneRow[],
  squadraId: string,
): StatoSquadra {
  const mie = assegnazioni.filter((a) => a.squadra_id === squadraId)
  const spesi = mie.reduce((t, a) => t + a.prezzo, 0)
  const perRuolo: Record<string, number> = { P: 0, D: 0, C: 0, A: 0 }
  for (const a of mie) perRuolo[a.ruolo_classic]++
  const totali = slotTotali(s)
  const rimasti = totali - mie.length
  const residui = s.budget - spesi
  return {
    spesi,
    residui,
    presi: mie.length,
    slotTotali: totali,
    slotRimasti: rimasti,
    maxOfferta: Math.max(0, residui - Math.max(0, rimasti - 1)),
    perRuolo,
  }
}

/** true se la squadra ha esaurito gli slot per quel ruolo. */
export function slotRuoloPieno(
  s: SessioneRow,
  assegnazioni: AssegnazioneRow[],
  squadraId: string,
  ruolo: string,
): boolean {
  const mie = assegnazioni.filter((a) => a.squadra_id === squadraId)
  if (s.modalita === 'mantra') {
    if (ruolo === 'P') {
      return mie.filter((a) => a.ruolo_classic === 'P').length >= (s.slot_config.portieri ?? 0)
    }
    return mie.filter((a) => a.ruolo_classic !== 'P').length >= (s.slot_config.movimento ?? 0)
  }
  const limite = s.slot_config.slot?.[ruolo] ?? 0
  return mie.filter((a) => a.ruolo_classic === ruolo).length >= limite
}
