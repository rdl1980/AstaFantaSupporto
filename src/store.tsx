/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useMemo, useReducer, useState } from 'react'
import type { ReactNode } from 'react'
import { DEFAULT_MODULES_TEXT } from './modules'
import type {
  AppState,
  Auction,
  ClassicRole,
  FantaTeam,
  LeagueConfig,
  Mode,
  Player,
  Purchase,
  Target,
  Vault,
} from './types'
import { CLASSIC_ROLE_ORDER, MAX_PARTECIPANTI, MIN_PARTECIPANTI, MODE_LABEL } from './types'

const VAULT_KEY = 'asta-fanta-vault-v2'
/** Chiave della versione a singola asta: letta una volta per migrare, mai riscritta. */
const LEGACY_KEY = 'asta-fanta-state-v1'

export function defaultConfig(): LeagueConfig {
  return {
    mode: 'mantra',
    budget: 4000,
    teams: squadrePer(8),
    classicSlots: { P: 6, D: 8, C: 9, A: 6 },
    mantraGk: 6,
    mantraOutfield: 29,
    budgetSplit: { P: 8, D: 20, C: 30, A: 42 },
    mantraPlanSlots: { P: 6, D: 10, C: 12, A: 7 },
    modulesText: DEFAULT_MODULES_TEXT,
    callMode: false,
    rilancioMinimo: 1,
    attesaSecondi: 5,
    intervalloSecondi: 3,
  }
}

/**
 * Costruisce l'elenco delle squadre per una nuova asta, conservando i nomi
 * di quelle esistenti quando se ne riporta la configurazione.
 */
function squadrePer(count: number, esistenti?: FantaTeam[]): FantaTeam[] {
  const n = Math.max(MIN_PARTECIPANTI, Math.min(MAX_PARTECIPANTI, Math.round(count)))
  const teams = Array.from({ length: n }, (_, i) => ({
    id: `t${i + 1}`,
    name: esistenti?.[i]?.name ?? (i === 0 ? 'La mia squadra' : `Squadra ${i + 1}`),
    isMine: i === 0,
  }))
  return teams
}

function newId(): string {
  return `a${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`
}

export function emptyState(mode: Mode): AppState {
  return {
    config: { ...defaultConfig(), mode },
    players: [],
    purchases: [],
    targets: {},
    listoneInfo: null,
  }
}

function newAuction(name: string, state: AppState): Auction {
  const now = Date.now()
  return { id: newId(), name, createdAt: now, updatedAt: now, state }
}

/** Uno stato salvato da una versione precedente puo non avere i campi aggiunti dopo. */
function sanitize(state: AppState): AppState {
  return {
    config: { ...defaultConfig(), ...state.config },
    players: Array.isArray(state.players) ? state.players : [],
    purchases: Array.isArray(state.purchases) ? state.purchases : [],
    targets: state.targets ?? {},
    listoneInfo: state.listoneInfo ?? null,
  }
}

function freshVault(): Vault {
  const first = newAuction(`Asta ${MODE_LABEL.mantra}`, emptyState('mantra'))
  return { version: 2, activeId: first.id, auctions: [first] }
}

function loadVault(): Vault {
  try {
    const raw = localStorage.getItem(VAULT_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Vault
      const auctions = (parsed?.auctions ?? [])
        .filter((a) => a?.state?.config)
        .map((a) => ({ ...a, state: sanitize(a.state) }))
      if (auctions.length > 0) {
        const activeId = auctions.some((a) => a.id === parsed.activeId) ? parsed.activeId : auctions[0].id
        return { version: 2, activeId, auctions }
      }
    }

    // Migrazione dalla versione a singola asta. La chiave vecchia resta dove
    // sta, intatta: un errore qui non fa perdere niente.
    const legacy = localStorage.getItem(LEGACY_KEY)
    if (legacy) {
      const parsed = JSON.parse(legacy) as AppState
      if (parsed?.config && Array.isArray(parsed.players)) {
        const state = sanitize(parsed)
        const migrated = newAuction(`Asta ${MODE_LABEL[state.config.mode]}`, state)
        return { version: 2, activeId: migrated.id, auctions: [migrated] }
      }
    }
  } catch {
    // vault corrotto o storage non disponibile: si riparte da zero
  }
  return freshVault()
}

export type Action =
  | { type: 'importPlayers'; players: Player[]; fileName: string }
  | { type: 'setConfig'; patch: Partial<LeagueConfig> }
  | { type: 'renameTeam'; teamId: string; name: string }
  | { type: 'purchase'; playerId: number; teamId: string; price: number }
  | { type: 'removePurchase'; playerId: number }
  | { type: 'undoLastPurchase' }
  | { type: 'toggleTarget'; playerId: number }
  | {
      type: 'addTargets'
      items: { playerId: number; maxPrice: number | null; priority: number | null; note: string }[]
    }
  | { type: 'setTarget'; playerId: number; patch: Partial<Target> }
  | { type: 'resetAuction' }
  | { type: 'fullReset' }
  | {
      /** Riporta nell'asta locale gli acquisti registrati nella sessione live */
      type: 'mergeLivePurchases'
      items: Purchase[]
      /** Giocatori che erano sul server e non ci sono piu': vanno tolti anche qui */
      remove: number[]
    }
  | { type: 'restoreState'; state: AppState }
  | {
      type: 'createAuction'
      name: string
      mode: Mode
      /** Fissato alla creazione: dopo non si cambia più */
      teamCount: number
      copyConfig: boolean
      copyListone: boolean
      copyTargets: boolean
    }
  | { type: 'switchAuction'; id: string }
  | { type: 'renameAuction'; id: string; name: string }
  | { type: 'deleteAuction'; id: string }
  | { type: 'duplicateAuction'; id: string }

function appReducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'importPlayers': {
      const ids = new Set(action.players.map((p) => p.id))
      // Re-import (file definitivo): mantieni acquisti e obiettivi ancora validi
      const purchases = state.purchases.filter((p) => ids.has(p.playerId))
      const targets = Object.fromEntries(
        Object.entries(state.targets).filter(([id]) => ids.has(Number(id))),
      )
      return {
        ...state,
        players: action.players,
        purchases,
        targets,
        listoneInfo: { fileName: action.fileName, importedAt: Date.now() },
      }
    }
    case 'setConfig':
      return { ...state, config: { ...state.config, ...action.patch } }
    case 'renameTeam':
      return {
        ...state,
        config: {
          ...state.config,
          teams: state.config.teams.map((t) => (t.id === action.teamId ? { ...t, name: action.name } : t)),
        },
      }
    case 'purchase': {
      const existing = state.purchases.find((p) => p.playerId === action.playerId)
      const others = state.purchases.filter((p) => p.playerId !== action.playerId)
      const purchase: Purchase = {
        playerId: action.playerId,
        teamId: action.teamId,
        price: Math.max(1, Math.round(action.price)),
        // Correggere un acquisto gia' registrato non lo sposta in fondo alla
        // cronologia: l'orario resta quello della chiamata originale. Altrimenti
        // "annulla ultimo" finirebbe per cancellare il giocatore sbagliato.
        ts: existing?.ts ?? Date.now(),
      }
      return { ...state, purchases: [...others, purchase] }
    }
    case 'mergeLivePurchases': {
      // Si aggiunge, si corregge, e si cancella soltanto cio' che il chiamante
      // sa essere stato rimosso dal server: un acquisto registrato solo in
      // locale non deve sparire per il fatto di non essere ancora lassu'.
      const perId = new Map(state.purchases.map((p) => [p.playerId, p]))
      let cambiato = false
      for (const item of action.items) {
        const attuale = perId.get(item.playerId)
        if (!attuale) {
          perId.set(item.playerId, item)
          cambiato = true
        } else if (attuale.teamId !== item.teamId || attuale.price !== item.price) {
          // L'orario resta quello della chiamata originale: quello del server e'
          // l'istante in cui la riga e' stata scritta lassu', e per gli acquisti
          // caricati in blocco sarebbe tutto lo stesso minuto, appiattendo la
          // cronologia mostrata nel report.
          perId.set(item.playerId, { ...item, ts: attuale.ts })
          cambiato = true
        }
      }
      for (const id of action.remove) {
        if (perId.delete(id)) cambiato = true
      }
      // Nessuna differenza: si restituisce lo stato invariato, cosi' il
      // contenitore non ricrea nulla e non si innescano cicli di render.
      if (!cambiato) return state
      return { ...state, purchases: [...perId.values()] }
    }
    case 'removePurchase':
      return { ...state, purchases: state.purchases.filter((p) => p.playerId !== action.playerId) }
    case 'undoLastPurchase': {
      if (state.purchases.length === 0) return state
      const last = state.purchases.reduce((a, b) => (a.ts > b.ts ? a : b))
      return { ...state, purchases: state.purchases.filter((p) => p !== last) }
    }
    case 'toggleTarget': {
      const targets = { ...state.targets }
      if (targets[action.playerId]) delete targets[action.playerId]
      else targets[action.playerId] = { playerId: action.playerId, maxPrice: null, note: '', priority: null }
      return { ...state, targets }
    }
    case 'addTargets': {
      const targets = { ...state.targets }
      for (const item of action.items) {
        const existing = targets[item.playerId]
        targets[item.playerId] = {
          playerId: item.playerId,
          // Un valore già impostato a mano non viene sovrascritto da un import che non lo porta
          maxPrice: item.maxPrice ?? existing?.maxPrice ?? null,
          priority: item.priority ?? existing?.priority ?? null,
          note: item.note || existing?.note || '',
        }
      }
      return { ...state, targets }
    }
    case 'setTarget': {
      const existing = state.targets[action.playerId] ?? {
        playerId: action.playerId,
        maxPrice: null,
        note: '',
        priority: null,
      }
      return { ...state, targets: { ...state.targets, [action.playerId]: { ...existing, ...action.patch } } }
    }
    case 'resetAuction':
      return { ...state, purchases: [] }
    case 'fullReset':
      return { config: defaultConfig(), players: [], purchases: [], targets: {}, listoneInfo: null }
    case 'restoreState':
      // Un backup salvato da una versione precedente puo' non avere i campi di
      // config aggiunti dopo: senza questa normalizzazione l'app va in pagina bianca
      return sanitize(action.state)
    default:
      return state
  }
}

/**
 * Le azioni sul contenitore gestiscono l'elenco delle aste; tutte le altre
 * finiscono sull'asta attiva. Cosi i componenti continuano a lavorare su un
 * singolo AppState senza sapere che ne esistono altri.
 */
function vaultReducer(vault: Vault, action: Action): Vault {
  switch (action.type) {
    case 'createAuction': {
      const src = vault.auctions.find((a) => a.id === vault.activeId)
      const copyListone = action.copyListone && !!src
      const config = action.copyConfig && src ? { ...src.state.config } : defaultConfig()
      const state: AppState = {
        config: {
          ...config,
          mode: action.mode,
          teams: squadrePer(action.teamCount, action.copyConfig ? src?.state.config.teams : undefined),
        },
        players: copyListone ? src!.state.players : [],
        purchases: [],
        // Gli obiettivi riferiscono gli id del listone: senza listone non hanno appiglio
        targets: copyListone && action.copyTargets ? src!.state.targets : {},
        listoneInfo: copyListone ? src!.state.listoneInfo : null,
      }
      const created = newAuction(action.name.trim() || `Asta ${MODE_LABEL[action.mode]}`, state)
      return { ...vault, activeId: created.id, auctions: [...vault.auctions, created] }
    }
    case 'switchAuction':
      return vault.auctions.some((a) => a.id === action.id) ? { ...vault, activeId: action.id } : vault
    case 'renameAuction':
      return {
        ...vault,
        auctions: vault.auctions.map((a) =>
          a.id === action.id ? { ...a, name: action.name, updatedAt: Date.now() } : a,
        ),
      }
    case 'deleteAuction': {
      // Resta sempre almeno un'asta: senza, l'app non avrebbe uno stato su cui lavorare
      if (vault.auctions.length <= 1) return vault
      const auctions = vault.auctions.filter((a) => a.id !== action.id)
      const activeId = auctions.some((a) => a.id === vault.activeId) ? vault.activeId : auctions[0].id
      return { ...vault, activeId, auctions }
    }
    case 'duplicateAuction': {
      const src = vault.auctions.find((a) => a.id === action.id)
      if (!src) return vault
      const copy = newAuction(`${src.name} (copia)`, src.state)
      // La copia non diventa attiva: chi duplica sta di solito ancora lavorando sull'originale
      return { ...vault, auctions: [...vault.auctions, copy] }
    }
    default: {
      const idx = vault.auctions.findIndex((a) => a.id === vault.activeId)
      if (idx < 0) return vault
      const current = vault.auctions[idx]
      const next = appReducer(current.state, action)
      if (next === current.state) return vault
      const auctions = [...vault.auctions]
      auctions[idx] = { ...current, state: next, updatedAt: Date.now() }
      return { ...vault, auctions }
    }
  }
}

// ---- Selettori / logica derivata ----

export function playerFvm(p: Player, mode: Mode): number {
  return mode === 'mantra' ? p.fvmM : p.fvm
}

export function playerQt(p: Player, mode: Mode): number {
  return mode === 'mantra' ? p.qtAM : p.qtA
}

export function totalSlots(config: LeagueConfig): number {
  return config.mode === 'mantra'
    ? config.mantraGk + config.mantraOutfield
    : CLASSIC_ROLE_ORDER.reduce((s, r) => s + config.classicSlots[r], 0)
}

/**
 * Prezzo suggerito: distribuisce tutti i crediti della lega sul pool dei
 * migliori N giocatori disponibili (N = slot totali x squadre),
 * proporzionalmente all'FVM. Autocalibrante rispetto a budget e lega.
 */
export function buildSuggestions(players: Player[], config: LeagueConfig): Map<number, number> {
  const mode = config.mode
  const n = totalSlots(config) * config.teams.length
  const pool = players
    .filter((p) => !p.ceduto)
    .sort((a, b) => playerFvm(b, mode) - playerFvm(a, mode))
    .slice(0, n)
  const sumFvm = pool.reduce((s, p) => s + playerFvm(p, mode), 0)
  const totalCredits = config.budget * config.teams.length
  const map = new Map<number, number>()
  if (sumFvm <= 0) return map
  for (const p of players) {
    if (p.ceduto) continue
    map.set(p.id, Math.max(1, Math.round((playerFvm(p, mode) * totalCredits) / sumFvm)))
  }
  return map
}

export interface TeamStats {
  teamId: string
  spent: number
  remaining: number
  count: number
  gkCount: number
  outfieldCount: number
  classicCounts: Record<ClassicRole, number>
  slotsLeft: number
  /** Offerta massima: budget residuo meno 1 credito per ogni altro slot da riempire */
  maxBid: number
}

export function teamStats(state: AppState, teamId: string): TeamStats {
  const { config } = state
  const byId = new Map(state.players.map((p) => [p.id, p]))
  const mine = state.purchases.filter((p) => p.teamId === teamId)
  const spent = mine.reduce((s, p) => s + p.price, 0)
  const remaining = config.budget - spent
  const classicCounts: Record<ClassicRole, number> = { P: 0, D: 0, C: 0, A: 0 }
  let gkCount = 0
  for (const pu of mine) {
    const pl = byId.get(pu.playerId)
    if (!pl) continue
    classicCounts[pl.r]++
    if (pl.r === 'P') gkCount++
  }
  const count = mine.length
  const outfieldCount = count - gkCount
  const slotsLeft = totalSlots(config) - count
  return {
    teamId,
    spent,
    remaining,
    count,
    gkCount,
    outfieldCount,
    classicCounts,
    slotsLeft,
    maxBid: Math.max(0, remaining - Math.max(0, slotsLeft - 1)),
  }
}

/**
 * Quanto puo' offrire una squadra per il giocatore in trattativa, lasciando un
 * credito per ogni altro slot ancora da riempire.
 *
 * `refund` e' il prezzo di un acquisto della stessa squadra che si sta
 * correggendo: quei crediti tornano disponibili e lo slot che occupa va
 * ricontato fra quelli da riempire.
 */
export function maxBidFor(state: AppState, teamId: string, refund = 0): number {
  const s = teamStats(state, teamId)
  const available = s.remaining + refund
  const slotsToFill = refund > 0 ? s.slotsLeft + 1 : s.slotsLeft
  return Math.max(0, available - Math.max(0, slotsToFill - 1))
}

/** Crediti effettivamente spendibili, senza tenere conto degli slot da coprire. */
export function availableFor(state: AppState, teamId: string, refund = 0): number {
  return teamStats(state, teamId).remaining + refund
}

// ---- Context ----

interface Store {
  /** Stato dell'asta attiva: i componenti non vedono le altre */
  state: AppState
  dispatch: (a: Action) => void
  suggestions: Map<number, number>
  playersById: Map<number, Player>
  purchaseByPlayer: Map<number, Purchase>
  myTeamId: string
  auctions: Auction[]
  activeAuction: Auction
  /** true se l'ultimo salvataggio su localStorage e fallito (storage pieno) */
  saveError: boolean
}

const StoreContext = createContext<Store | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [vault, dispatch] = useReducer(vaultReducer, undefined, loadVault)
  const [saveError, setSaveError] = useState(false)

  // Qui l'effetto e' al suo posto: sincronizza con localStorage, che e' un
  // sistema esterno, e lo stato serve solo a riflettere l'esito della scrittura.
  useEffect(() => {
    try {
      localStorage.setItem(VAULT_KEY, JSON.stringify(vault))
      // Forma funzionale: se lo stato non cambia React non rende di nuovo
      /* eslint-disable-next-line react/set-state-in-effect */
      setSaveError((prev) => (prev ? false : prev))
    } catch {
      // Storage pieno: l'app continua in memoria, ma i dati non sono piu al sicuro
      /* eslint-disable-next-line react/set-state-in-effect */
      setSaveError((prev) => (prev ? prev : true))
    }
  }, [vault])

  const activeAuction = vault.auctions.find((a) => a.id === vault.activeId) ?? vault.auctions[0]
  const state = activeAuction.state

  const suggestions = useMemo(
    () => buildSuggestions(state.players, state.config),
    [state.players, state.config],
  )
  const playersById = useMemo(() => new Map(state.players.map((p) => [p.id, p])), [state.players])
  const purchaseByPlayer = useMemo(
    () => new Map(state.purchases.map((p) => [p.playerId, p])),
    [state.purchases],
  )
  const myTeamId = state.config.teams.find((t) => t.isMine)?.id ?? state.config.teams[0]?.id ?? 't1'

  const store = useMemo(
    () => ({
      state,
      dispatch,
      suggestions,
      playersById,
      purchaseByPlayer,
      myTeamId,
      auctions: vault.auctions,
      activeAuction,
      saveError,
    }),
    [state, suggestions, playersById, purchaseByPlayer, myTeamId, vault.auctions, activeAuction, saveError],
  )

  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>
}

export function useStore(): Store {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore fuori da StoreProvider')
  return ctx
}
