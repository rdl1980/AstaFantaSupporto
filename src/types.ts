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
  /** 1 = Prio1, 2 = Prio2, 3 = Low, 4 = Scommessa; null = senza priorità */
  priority: number | null
}

export const PRIORITY_ORDER = [1, 2, 3, 4]

export const PRIORITY_LABEL: Record<number, string> = {
  1: 'Prio1',
  2: 'Prio2',
  3: 'Low',
  4: 'Scommessa',
}

export const PRIORITY_SHORT: Record<number, string> = { 1: 'P1', 2: 'P2', 3: 'Low', 4: 'S' }

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
  /** Modalita' chiamata: il click sul listone mette il giocatore in trattativa invece di aprire il dialog */
  callMode: boolean
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

/** Un'asta salvata: le regole della lega, il listone e tutto ciò che vi è successo. */
export interface Auction {
  id: string
  name: string
  createdAt: number
  updatedAt: number
  state: AppState
}

/** Radice della persistenza: tutte le aste salvate più quella attiva. */
export interface Vault {
  version: number
  activeId: string
  auctions: Auction[]
}

export const MODE_LABEL: Record<Mode, string> = { mantra: 'Mantra', classic: 'Classic' }

export function otherMode(mode: Mode): Mode {
  return mode === 'mantra' ? 'classic' : 'mantra'
}
