export type ClassicRole = 'P' | 'D' | 'C' | 'A'

export interface Player {
  id: number
  name: string
  team: string
  /** Ruolo Classic: P/D/C/A */
  r: ClassicRole
  /** Ruoli Mantra, es. ['E','W'] */
  rm: string[]
  qtA: number
  qtI: number
  qtAM: number
  qtIM: number
  fvm: number
  fvmM: number
  /** Presente nel foglio Ceduti: non più utilizzabile */
  ceduto: boolean
}

export interface FantaTeam {
  id: string
  name: string
  isMine: boolean
}

export interface Purchase {
  playerId: number
  teamId: string
  price: number
  ts: number
}

export interface Target {
  playerId: number
  maxPrice: number | null
  note: string
}

export type Mode = 'mantra' | 'classic'

export interface LeagueConfig {
  mode: Mode
  budget: number
  teams: FantaTeam[]
  /** Slot per ruolo in modalità Classic */
  classicSlots: Record<ClassicRole, number>
  /** Slot portieri in modalità Mantra */
  mantraGk: number
  /** Slot giocatori di movimento in modalità Mantra */
  mantraOutfield: number
  /** Ripartizione del budget per reparto, in percentuale (somma attesa: 100) */
  budgetSplit: Record<ClassicRole, number>
  /** Quanti giocatori conto di prendere per reparto in Mantra (solo pianificazione; P non usato) */
  mantraPlanSlots: Record<ClassicRole, number>
  /** Tabella dei moduli Mantra, nel formato "Nome: slot, slot, ..." (una riga per modulo) */
  modulesText: string
}

export interface AppState {
  config: LeagueConfig
  players: Player[]
  purchases: Purchase[]
  targets: Record<number, Target>
  /** Nome del file listone importato + data import */
  listoneInfo: { fileName: string; importedAt: number } | null
}

/** Ordine canonico dei ruoli Mantra (fantacalcio.it) */
export const MANTRA_ROLE_ORDER = ['Por', 'Ds', 'Dd', 'Dc', 'B', 'E', 'M', 'C', 'W', 'T', 'A', 'Pc']

export const CLASSIC_ROLE_ORDER: ClassicRole[] = ['P', 'D', 'C', 'A']

export const CLASSIC_ROLE_LABEL: Record<ClassicRole, string> = {
  P: 'Portieri',
  D: 'Difensori',
  C: 'Centrocampisti',
  A: 'Attaccanti',
}
