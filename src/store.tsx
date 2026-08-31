/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useMemo, useReducer } from 'react'
import type { ReactNode } from 'react'
import type { AppState, ClassicRole, LeagueConfig, Mode, Player, Purchase, Target } from './types'
import { CLASSIC_ROLE_ORDER } from './types'

const STORAGE_KEY = 'asta-fanta-state-v1'

export function defaultConfig(): LeagueConfig {
  return {
    mode: 'mantra',
    budget: 4000,
    teams: Array.from({ length: 8 }, (_, i) => ({
      id: `t${i + 1}`,
      name: i === 0 ? 'La mia squadra' : `Squadra ${i + 1}`,
      isMine: i === 0,
    })),
    classicSlots: { P: 6, D: 8, C: 9, A: 6 },
    mantraGk: 6,
    mantraOutfield: 29,
  }
}

function initialState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as AppState
      if (parsed && parsed.config && Array.isArray(parsed.players)) return parsed
    }
  } catch {
    // stato corrotto o storage non disponibile: si riparte da zero
  }
  return { config: defaultConfig(), players: [], purchases: [], targets: {}, listoneInfo: null }
}

export type Action =
  | { type: 'importPlayers'; players: Player[]; fileName: string }
  | { type: 'setConfig'; patch: Partial<LeagueConfig> }
  | { type: 'renameTeam'; teamId: string; name: string }
  | { type: 'setTeamCount'; count: number }
  | { type: 'purchase'; playerId: number; teamId: string; price: number }
  | { type: 'removePurchase'; playerId: number }
  | { type: 'undoLastPurchase' }
  | { type: 'toggleTarget'; playerId: number }
  | { type: 'setTarget'; playerId: number; patch: Partial<Target> }
  | { type: 'resetAuction' }
  | { type: 'fullReset' }
  | { type: 'restoreState'; state: AppState }

function reducer(state: AppState, action: Action): AppState {
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
    case 'setTeamCount': {
      const count = Math.max(2, Math.min(20, action.count))
      const teams = [...state.config.teams]
      while (teams.length < count) {
        teams.push({ id: `t${teams.length + 1}`, name: `Squadra ${teams.length + 1}`, isMine: false })
      }
      const kept = teams.slice(0, count)
      if (!kept.some((t) => t.isMine)) kept[0] = { ...kept[0], isMine: true }
      const keptIds = new Set(kept.map((t) => t.id))
      return {
        ...state,
        config: { ...state.config, teams: kept },
        purchases: state.purchases.filter((p) => keptIds.has(p.teamId)),
      }
    }
    case 'purchase': {
      const others = state.purchases.filter((p) => p.playerId !== action.playerId)
      const purchase: Purchase = {
        playerId: action.playerId,
        teamId: action.teamId,
        price: Math.max(1, Math.round(action.price)),
        ts: Date.now(),
      }
      return { ...state, purchases: [...others, purchase] }
    }
    case 'removePurchase':
      return { ...state, purchases: state.purchases.filter((p) => p.playerId !== action.playerId) }
    case 'undoLastPurchase': {
      if (state.purchases.length === 0) return state
      const last = state.purchases.reduce((a, b) => (a.ts >= b.ts ? a : b))
      return { ...state, purchases: state.purchases.filter((p) => p !== last) }
    }
    case 'toggleTarget': {
      const targets = { ...state.targets }
      if (targets[action.playerId]) delete targets[action.playerId]
      else targets[action.playerId] = { playerId: action.playerId, maxPrice: null, note: '' }
      return { ...state, targets }
    }
    case 'setTarget': {
      const existing = state.targets[action.playerId] ?? { playerId: action.playerId, maxPrice: null, note: '' }
      return { ...state, targets: { ...state.targets, [action.playerId]: { ...existing, ...action.patch } } }
    }
    case 'resetAuction':
      return { ...state, purchases: [] }
    case 'fullReset':
      return { config: defaultConfig(), players: [], purchases: [], targets: {}, listoneInfo: null }
    case 'restoreState':
      return action.state
    default:
      return state
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

// ---- Context ----

interface Store {
  state: AppState
  dispatch: (a: Action) => void
  suggestions: Map<number, number>
  playersById: Map<number, Player>
  purchaseByPlayer: Map<number, Purchase>
  myTeamId: string
}

const StoreContext = createContext<Store | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, initialState)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch {
      // storage pieno o non disponibile: l'app continua a funzionare in memoria
    }
  }, [state])

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
    () => ({ state, dispatch, suggestions, playersById, purchaseByPlayer, myTeamId }),
    [state, suggestions, playersById, purchaseByPlayer, myTeamId],
  )

  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>
}

export function useStore(): Store {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore fuori da StoreProvider')
  return ctx
}
