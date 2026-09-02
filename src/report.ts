import { playerFvm, teamStats } from './store'
import type { TeamStats } from './store'
import type { AppState, ClassicRole, FantaTeam, Player, Purchase } from './types'
import { CLASSIC_ROLE_ORDER } from './types'

/** Una riga di rosa: quanto è costato rispetto a quanto valeva. */
export interface RosterRow {
  player: Player
  price: number
  suggested: number
  /** Positivo = pagato più del suggerito */
  delta: number
  deltaPct: number | null
  fvm: number
  ts: number
}

export function rosterRows(
  state: AppState,
  teamId: string,
  suggestions: Map<number, number>,
): RosterRow[] {
  const byId = new Map(state.players.map((p) => [p.id, p]))
  const mode = state.config.mode
  return state.purchases
    .filter((pu) => pu.teamId === teamId)
    .map((pu) => {
      const player = byId.get(pu.playerId)
      if (!player) return null
      const suggested = suggestions.get(player.id) ?? 0
      const delta = pu.price - suggested
      return {
        player,
        price: pu.price,
        suggested,
        delta,
        deltaPct: suggested > 0 ? (delta / suggested) * 100 : null,
        fvm: playerFvm(player, mode),
        ts: pu.ts,
      }
    })
    .filter((r): r is RosterRow => r !== null)
    .sort((a, b) => b.price - a.price)
}

export interface RepartoTotals {
  count: number
  spent: number
  fvm: number
}

export interface TeamReport {
  team: FantaTeam
  stats: TeamStats
  rows: RosterRow[]
  /** Somma degli FVM della rosa: il valore "sulla carta" */
  totalFvm: number
  totalSpent: number
  /** Somma dei prezzi suggeriti dei giocatori presi */
  totalSuggested: number
  /** Positivo = ha speso più del valore suggerito della sua rosa */
  delta: number
  /** FVM ottenuto per ogni credito speso: misura di efficienza */
  fvmPerCredit: number
  byReparto: Record<ClassicRole, RepartoTotals>
}

export function teamReports(state: AppState, suggestions: Map<number, number>): TeamReport[] {
  const byId = new Map(state.players.map((p) => [p.id, p]))
  return state.config.teams
    .map((team) => {
      const rows = rosterRows(state, team.id, suggestions)
      const byReparto = Object.fromEntries(
        CLASSIC_ROLE_ORDER.map((r) => [r, { count: 0, spent: 0, fvm: 0 }]),
      ) as Record<ClassicRole, RepartoTotals>
      for (const row of rows) {
        const r = byId.get(row.player.id)!.r
        byReparto[r].count++
        byReparto[r].spent += row.price
        byReparto[r].fvm += row.fvm
      }
      const totalSpent = rows.reduce((s, x) => s + x.price, 0)
      const totalSuggested = rows.reduce((s, x) => s + x.suggested, 0)
      const totalFvm = rows.reduce((s, x) => s + x.fvm, 0)
      return {
        team,
        stats: teamStats(state, team.id),
        rows,
        totalFvm,
        totalSpent,
        totalSuggested,
        delta: totalSpent - totalSuggested,
        fvmPerCredit: totalSpent > 0 ? totalFvm / totalSpent : 0,
        byReparto,
      }
    })
    .sort((a, b) => b.totalFvm - a.totalFvm)
}

export interface TimelineEntry {
  /** Progressivo di chiamata, 1 = primo acquisto registrato */
  index: number
  purchase: Purchase
  player: Player
  teamName: string
  isMine: boolean
  suggested: number
  delta: number
}

export function timeline(state: AppState, suggestions: Map<number, number>): TimelineEntry[] {
  const byId = new Map(state.players.map((p) => [p.id, p]))
  const teamById = new Map(state.config.teams.map((t) => [t.id, t]))
  return [...state.purchases]
    .sort((a, b) => a.ts - b.ts)
    .map((purchase, i) => {
      const player = byId.get(purchase.playerId)
      const team = teamById.get(purchase.teamId)
      if (!player) return null
      const suggested = suggestions.get(player.id) ?? 0
      return {
        index: i + 1,
        purchase,
        player,
        teamName: team?.name ?? '?',
        isMine: !!team?.isMine,
        suggested,
        delta: purchase.price - suggested,
      }
    })
    .filter((e): e is TimelineEntry => e !== null)
}

export interface ClubCoverage {
  /** Squadra di Serie A */
  club: string
  count: number
  spent: number
  players: Player[]
}

/**
 * Quante squadre di Serie A copre la rosa. Concentrare troppi giocatori su un
 * solo club espone: una brutta giornata di quel club affonda l'intera giornata.
 */
export function clubCoverage(state: AppState, teamId: string, suggestions: Map<number, number>): ClubCoverage[] {
  const map = new Map<string, ClubCoverage>()
  for (const row of rosterRows(state, teamId, suggestions)) {
    const club = row.player.team
    const entry = map.get(club) ?? { club, count: 0, spent: 0, players: [] }
    entry.count++
    entry.spent += row.price
    entry.players.push(row.player)
    map.set(club, entry)
  }
  return [...map.values()].sort((a, b) => b.count - a.count || a.club.localeCompare(b.club))
}

/** Migliori affari e peggiori sovrapprezzi, per scostamento dal prezzo suggerito. */
export function deals(rows: RosterRow[], n = 5): { bargains: RosterRow[]; overpaid: RosterRow[] } {
  // Senza un prezzo suggerito lo scostamento non significa nulla
  const scored = rows.filter((r) => r.suggested > 0)
  const asc = [...scored].sort((a, b) => a.delta - b.delta)
  return {
    bargains: asc.filter((r) => r.delta < 0).slice(0, n),
    overpaid: asc
      .filter((r) => r.delta > 0)
      .slice(-n)
      .reverse(),
  }
}
