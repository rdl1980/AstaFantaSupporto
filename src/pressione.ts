import type { AppState, ClassicRole } from './types'

/**
 * Chi ha fame di cosa.
 *
 * La scheda Squadre dice quanti crediti ha ciascuno. Non e' la stessa cosa che
 * sapere cosa ne fara': una squadra con ottocento crediti e due portieri ancora
 * da prendere e' costretta a spenderli, e sul prossimo portiere tirera'. Una con
 * gli stessi ottocento e la rosa quasi completa puo' permettersi di stare
 * ferma.
 *
 * La cifra che separa i due casi e' quanto resta *per ogni slot ancora da
 * riempire*: e' il tetto medio che quella squadra puo' tenere da qui alla fine, e
 * dice se al prossimo rilancio potra' seguirti o no.
 */

/** Il poco che serve sapere di una squadra: coincide con `TeamStats` dello store. */
export interface StatiSquadra {
  remaining: number
  slotsLeft: number
  maxBid: number
  classicCounts: Record<ClassicRole, number>
  gkCount: number
  outfieldCount: number
}

export interface RepartoMancante {
  /** 'P' | 'D' | 'C' | 'A' in Classic; 'P' | 'MOV' in Mantra */
  chiave: string
  label: string
  quanti: number
}

export interface RigaPressione {
  teamId: string
  nome: string
  mia: boolean
  residui: number
  slotMancanti: number
  /**
   * Crediti per ogni slot ancora da riempire. Zero quando la rosa e' completa:
   * i crediti avanzati non comprano piu' niente e non fanno pressione.
   */
  perSlot: number
  /** Massimo su un singolo giocatore, tenendo un credito per ogni altro slot */
  maxOfferta: number
  mancanti: RepartoMancante[]
}

const LABEL: Record<string, string> = {
  P: 'Portieri', D: 'Difensori', C: 'Centrocampisti', A: 'Attaccanti', MOV: 'Movimento',
}

function mancantiDi(state: AppState, s: StatiSquadra): RepartoMancante[] {
  const { config } = state
  const voci =
    config.mode === 'mantra'
      ? [
          { chiave: 'P', quanti: config.mantraGk - s.gkCount },
          { chiave: 'MOV', quanti: config.mantraOutfield - s.outfieldCount },
        ]
      : (['P', 'D', 'C', 'A'] as ClassicRole[]).map((r) => ({
          chiave: r,
          quanti: config.classicSlots[r] - s.classicCounts[r],
        }))
  return voci
    .filter((v) => v.quanti > 0)
    .map((v) => ({ chiave: v.chiave, label: LABEL[v.chiave] ?? v.chiave, quanti: v.quanti }))
}

/**
 * Una riga per squadra, dalla piu' capace di spingere alla meno capace.
 *
 * @param statiDi restituisce i conti di una squadra. Arriva da fuori perche' li
 *   tiene lo store, che non si puo' importare qui senza tirarsi dietro React.
 */
export function pressione(state: AppState, statiDi: (teamId: string) => StatiSquadra): RigaPressione[] {
  return state.config.teams
    .map((t) => {
      const s = statiDi(t.id)
      return {
        teamId: t.id,
        nome: t.name,
        mia: t.isMine,
        residui: s.remaining,
        slotMancanti: s.slotsLeft,
        perSlot: s.slotsLeft > 0 ? Math.floor(s.remaining / s.slotsLeft) : 0,
        maxOfferta: s.maxBid,
        mancanti: mancantiDi(state, s),
      }
    })
    .sort((a, b) => b.perSlot - a.perSlot || b.residui - a.residui)
}

/**
 * Gli avversari che quel reparto devono ancora coprirlo, dal piu' pericoloso.
 * E' la lettura che serve mentre un giocatore e' in trattativa: non "chi ha
 * crediti", ma "chi ha crediti *e* quel buco da riempire".
 */
export function chiHaFameDi(righe: RigaPressione[], ruolo: ClassicRole, mantra: boolean): RigaPressione[] {
  const chiave = mantra && ruolo !== 'P' ? 'MOV' : ruolo
  return righe.filter((r) => !r.mia && r.mancanti.some((m) => m.chiave === chiave))
}
