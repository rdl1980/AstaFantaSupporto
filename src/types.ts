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

/** Come si calcolano i crediti restituiti da uno svincolo */
export type TipoRimborso = 'prezzo' | 'quotazione' | 'percentuale'

/**
 * Un giocatore uscito da una rosa durante il mercato di riparazione.
 *
 * Non e' un acquisto cancellato: l'acquisto sparito dalla cronologia la
 * renderebbe una bugia, e il report di fine anno deve poter mostrare tutte e due
 * le fasi. Nome, club e ruolo sono copiati qui perche' uno svincolo forzato
 * avviene proprio quando il giocatore non e' piu' nel listone: cercarlo dopo non
 * darebbe niente.
 */
export interface Svincolo {
  playerId: number
  teamId: string
  /** Prezzo a cui era stato preso */
  price: number
  /** Istante dell'acquisto originale, cosi' la cronologia resta in ordine */
  ts: number
  svincolatoIl: number
  /** Crediti restituiti. La differenza col prezzo e' quanto ci hai rimesso */
  rimborso: number
  /** Non scelto: il giocatore ha lasciato la Serie A */
  forzato: boolean
  nome: string
  club: string
  ruolo: ClassicRole
  ruoliMantra: string[]
}

/** Stato della finestra di gennaio. */
export interface Riparazione {
  /** A finestra chiusa gli svincoli non si fanno e il budget extra non conta */
  aperta: boolean
  /** Crediti aggiuntivi, uguali per tutte le squadre */
  budgetExtra: number
  rimborso: TipoRimborso
  /** Usata solo quando il rimborso e' 'percentuale' */
  rimborsoPercento: number
}

/** Cosa e' cambiato fra il listone precedente e quello appena importato. */
export interface DiffListone {
  quando: number
  fileName: string
  nuovi: number
  cambioSquadra: { id: number; nome: string; da: string; a: string }[]
  usciti: { id: number; nome: string; club: string; ruolo: ClassicRole }[]
  /** Quanti degli usciti erano in una rosa, e sono diventati svincoli forzati */
  svincoliForzati: number
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

/** Quotazione di riferimento secondo la modalita'. */
export function playerQt(p: Player, mode: Mode): number {
  return mode === 'mantra' ? p.qtAM : p.qtA
}

/** Quanti giocatori compongono una rosa completa. */
export function totalSlots(config: LeagueConfig): number {
  return config.mode === 'mantra'
    ? config.mantraGk + config.mantraOutfield
    : CLASSIC_ROLE_ORDER.reduce((s, r) => s + config.classicSlots[r], 0)
}

export const PRIORITY_ORDER = [1, 2, 3, 4]

export const PRIORITY_LABEL: Record<number, string> = {
  1: 'Prio1',
  2: 'Prio2',
  3: 'Low',
  4: 'Scommessa',
}

export const PRIORITY_SHORT: Record<number, string> = { 1: 'P1', 2: 'P2', 3: 'Low', 4: 'S' }

/** Estremi consentiti per il numero di partecipanti a un'asta */
export const MIN_PARTECIPANTI = 2
export const MAX_PARTECIPANTI = 10

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
  /** Rilancio minimo consentito, in crediti */
  rilancioMinimo: number
  /** Secondi dall'ultima offerta all'inizio del conteggio */
  attesaSecondi: number
  /** Secondi fra "uno" e "due" */
  secondiDa1A2: number
  /** Secondi fra "due" e "tre", e fra "tre" e l'aggiudicazione */
  secondiDa2A3: number
  /** Scalini dei pulsanti di rilancio rapido sul telefono dei partecipanti */
  rilanciRapidi: number[]
  /** Millisecondi di blocco dei pulsanti dopo un cambio di prezzo */
  attesaOffertaMs: number
  /** Asta a sorteggio: pesca da tutto il listone o da un reparto alla volta */
  sorteggioAmbito: 'tutti' | 'ruolo'
}

export interface AppState {
  config: LeagueConfig
  /** Giocatori usciti dalle rose nel mercato di riparazione */
  svincoli: Svincolo[]
  riparazione: Riparazione
  /** Cosa e' cambiato all'ultimo re-import del listone */
  diffListone: DiffListone | null
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
