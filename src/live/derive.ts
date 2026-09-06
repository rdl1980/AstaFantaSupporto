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
  // Una configurazione incompleta non deve lasciare un telefono con la
  // schermata bianca in mezzo all'asta: meglio mostrare zero slot.
  const cfg = s.slot_config ?? {}
  if (s.modalita === 'mantra') {
    return (cfg.portieri ?? 0) + (cfg.movimento ?? 0)
  }
  const slot = cfg.slot ?? {}
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
  const cfg = s.slot_config ?? {}
  if (s.modalita === 'mantra') {
    if (ruolo === 'P') {
      return mie.filter((a) => a.ruolo_classic === 'P').length >= (cfg.portieri ?? 0)
    }
    return mie.filter((a) => a.ruolo_classic !== 'P').length >= (cfg.movimento ?? 0)
  }
  const limite = cfg.slot?.[ruolo] ?? 0
  return mie.filter((a) => a.ruolo_classic === ruolo).length >= limite
}

export interface RepartoLive {
  /** Chiave del ruolo Classic, o 'MOV' per il movimento in Mantra */
  chiave: string
  label: string
  presi: number
  totali: number
  mancanti: number
}

/**
 * Quanti giocatori mancano per completare ogni reparto.
 *
 * In Mantra i ruoli di movimento non hanno quote separate: conta solo la
 * divisione fra portieri e resto della rosa, ed è così che va mostrata.
 */
export function repartiLive(
  s: SessioneRow,
  assegnazioni: AssegnazioneRow[],
  squadraId: string,
): RepartoLive[] {
  const mie = assegnazioni.filter((a) => a.squadra_id === squadraId)
  const conta = (f: (a: AssegnazioneRow) => boolean) => mie.filter(f).length
  const riga = (chiave: string, label: string, presi: number, totali: number): RepartoLive => ({
    chiave,
    label,
    presi,
    totali,
    mancanti: Math.max(0, totali - presi),
  })

  const cfg = s.slot_config ?? {}
  if (s.modalita === 'mantra') {
    return [
      riga('P', 'Portieri', conta((a) => a.ruolo_classic === 'P'), cfg.portieri ?? 0),
      riga('MOV', 'Movimento', conta((a) => a.ruolo_classic !== 'P'), cfg.movimento ?? 0),
    ]
  }
  const etichette: Record<string, string> = {
    P: 'Portieri',
    D: 'Difensori',
    C: 'Centrocampisti',
    A: 'Attaccanti',
  }
  return (['P', 'D', 'C', 'A'] as const).map((r) =>
    riga(r, etichette[r], conta((a) => a.ruolo_classic === r), cfg.slot?.[r] ?? 0),
  )
}
