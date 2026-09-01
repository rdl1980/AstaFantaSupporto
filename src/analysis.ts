import { playerFvm, teamStats } from './store'
import type { TeamStats } from './store'
import type { AppState, ClassicRole, Mode, Player } from './types'
import { CLASSIC_ROLE_LABEL, CLASSIC_ROLE_ORDER, MANTRA_ROLE_ORDER } from './types'

/** Elenco dei ruoli rilevanti per la modalità attiva, in ordine canonico. */
export function rolesForMode(players: Player[], mode: Mode): string[] {
  if (mode === 'classic') return [...CLASSIC_ROLE_ORDER]
  const present = new Set(players.flatMap((p) => p.rm))
  const known = MANTRA_ROLE_ORDER.filter((r) => present.has(r))
  const unknown = [...present].filter((r) => !MANTRA_ROLE_ORDER.includes(r)).sort()
  return [...known, ...unknown]
}

export function hasRole(p: Player, role: string, mode: Mode): boolean {
  return mode === 'mantra' ? p.rm.includes(role) : p.r === role
}

// ---------------- Mercato ----------------

export interface MarketStats {
  /** Crediti ancora in mano a tutta la lega */
  totalCredits: number
  /** Slot ancora da riempire in tutta la lega */
  totalSlots: number
  avgPerSlot: number
  myPerSlot: number
  oppPerSlot: number
  /** Scostamento % della mia disponibilità per slot rispetto agli avversari */
  edgePct: number | null
}

export function marketStats(state: AppState, statsByTeam: Map<string, TeamStats>): MarketStats {
  let totalCredits = 0
  let totalSlots = 0
  let myCredits = 0
  let mySlots = 0
  let oppCredits = 0
  let oppSlots = 0
  for (const t of state.config.teams) {
    const s = statsByTeam.get(t.id)
    if (!s) continue
    totalCredits += s.remaining
    totalSlots += s.slotsLeft
    if (t.isMine) {
      myCredits += s.remaining
      mySlots += s.slotsLeft
    } else {
      oppCredits += s.remaining
      oppSlots += s.slotsLeft
    }
  }
  const per = (c: number, s: number) => (s > 0 ? c / s : 0)
  const myPerSlot = per(myCredits, mySlots)
  const oppPerSlot = per(oppCredits, oppSlots)
  return {
    totalCredits,
    totalSlots,
    avgPerSlot: per(totalCredits, totalSlots),
    myPerSlot,
    oppPerSlot,
    edgePct: oppPerSlot > 0 ? Math.round((myPerSlot / oppPerSlot - 1) * 100) : null,
  }
}

export function computeTeamStats(state: AppState): Map<string, TeamStats> {
  return new Map(state.config.teams.map((t) => [t.id, teamStats(state, t.id)]))
}

// ---------------- Scarsità per ruolo ----------------

export interface Tier {
  label: string
  total: number
  left: number
}

export interface RoleScarcity {
  role: string
  total: number
  left: number
  tiers: Tier[]
  /** Slot ancora da riempire nella lega per questo ruolo (null se non determinabile) */
  demand: number | null
  teamsNeeding: number | null
  topLeft: Player[]
  /** Fascia alta (Top + Buoni) ancora disponibile */
  highLeft: number
  highTotal: number
}

/**
 * Fasce dimensionate sul numero di squadre: la Top è "uno a testa".
 * Sapere che restano 2 top per 8 squadre vale più di qualsiasi media.
 */
export function computeScarcity(state: AppState, statsByTeam: Map<string, TeamStats>): RoleScarcity[] {
  const { config, players } = state
  const mode = config.mode
  const sold = new Set(state.purchases.map((p) => p.playerId))
  const n = Math.max(2, config.teams.length)
  const tierDefs = [
    { label: 'Top', size: n },
    { label: 'Buoni', size: n },
    { label: 'Medi', size: n * 2 },
  ]

  const demandByRole = new Map<string, number>()
  const teamsNeedingByRole = new Map<string, number>()
  const addDemand = (role: string, missingOf: (s: TeamStats) => number) => {
    let demand = 0
    let teams = 0
    for (const t of config.teams) {
      const s = statsByTeam.get(t.id)
      if (!s) continue
      const missing = Math.max(0, missingOf(s))
      demand += missing
      if (missing > 0) teams++
    }
    demandByRole.set(role, demand)
    teamsNeedingByRole.set(role, teams)
  }

  if (mode === 'classic') {
    for (const r of CLASSIC_ROLE_ORDER) {
      addDemand(r, (s) => config.classicSlots[r] - s.classicCounts[r])
    }
  } else {
    // In Mantra solo i portieri hanno una quota certa: gli altri ruoli si sovrappongono.
    addDemand('Por', (s) => config.mantraGk - s.gkCount)
  }

  const result: RoleScarcity[] = []
  for (const role of rolesForMode(players, mode)) {
    const pool = players
      .filter((p) => !p.ceduto && hasRole(p, role, mode))
      .sort((a, b) => playerFvm(b, mode) - playerFvm(a, mode))
    if (pool.length === 0) continue

    const tiers: Tier[] = []
    let i = 0
    for (const def of tierDefs) {
      const slice = pool.slice(i, i + def.size)
      i += def.size
      if (slice.length === 0) continue
      tiers.push({
        label: def.label,
        total: slice.length,
        left: slice.filter((p) => !sold.has(p.id)).length,
      })
    }
    const high = pool.slice(0, n * 2)
    const left = pool.filter((p) => !sold.has(p.id))
    result.push({
      role,
      total: pool.length,
      left: left.length,
      tiers,
      demand: demandByRole.get(role) ?? null,
      teamsNeeding: teamsNeedingByRole.get(role) ?? null,
      topLeft: left.slice(0, 4),
      highLeft: high.filter((p) => !sold.has(p.id)).length,
      highTotal: high.length,
    })
  }
  return result
}

/** Posizione del giocatore tra quelli ancora disponibili nel suo ruolo. */
export function rankAmongRole(state: AppState, player: Player, role: string): { rank: number; total: number } {
  const mode = state.config.mode
  const sold = new Set(state.purchases.map((p) => p.playerId))
  const fvm = playerFvm(player, mode)
  let total = 0
  let better = 0
  for (const p of state.players) {
    if (p.ceduto || !hasRole(p, role, mode)) continue
    if (sold.has(p.id) && p.id !== player.id) continue
    total++
    if (playerFvm(p, mode) > fvm) better++
  }
  return { rank: better + 1, total }
}

// ---------------- Piano di spesa per reparto ----------------

export interface RepartoPlan {
  role: ClassicRole
  label: string
  /** Slot previsti per il reparto (in Mantra D/C/A sono una stima di pianificazione) */
  slots: number
  pct: number
  allocated: number
  spent: number
  bought: number
  /** Obiettivi del reparto non ancora assegnati a nessuno */
  targetsOpen: number
  /** Somma dei prezzi massimi degli obiettivi aperti */
  targetsSum: number
  /** Obiettivi aperti senza prezzo massimo impostato */
  targetsNoPrice: number
}

export function repartoSlots(state: AppState, r: ClassicRole): number {
  const { config } = state
  if (config.mode === 'classic') return config.classicSlots[r]
  return r === 'P' ? config.mantraGk : config.mantraPlanSlots[r]
}

export function repartoPlans(state: AppState, teamId: string): RepartoPlan[] {
  const { config } = state
  const byId = new Map(state.players.map((p) => [p.id, p]))
  const sold = new Set(state.purchases.map((p) => p.playerId))

  return CLASSIC_ROLE_ORDER.map((r) => {
    const mine = state.purchases.filter((pu) => pu.teamId === teamId && byId.get(pu.playerId)?.r === r)
    const open = Object.values(state.targets).filter((t) => {
      const pl = byId.get(t.playerId)
      return !!pl && pl.r === r && !sold.has(t.playerId)
    })
    const pct = config.budgetSplit[r] ?? 0
    return {
      role: r,
      label: CLASSIC_ROLE_LABEL[r],
      slots: repartoSlots(state, r),
      pct,
      allocated: Math.round((config.budget * pct) / 100),
      spent: mine.reduce((s, pu) => s + pu.price, 0),
      bought: mine.length,
      targetsOpen: open.length,
      targetsSum: open.reduce((s, t) => s + (t.maxPrice ?? 0), 0),
      targetsNoPrice: open.filter((t) => t.maxPrice == null).length,
    }
  })
}
