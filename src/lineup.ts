import type { ModuleDef, SlotDef } from './modules'
import type { Player } from './types'

/**
 * Assegnazione ottima dei giocatori agli slot di un modulo.
 *
 * È un problema di abbinamento su grafo bipartito: un giocatore multiruolo può
 * occupare slot diversi e la scelta migliore per uno slot dipende da tutte le
 * altre. Un'assegnazione golosa (il migliore disponibile slot per slot) sbaglia,
 * perciò si usa un flusso di costo minimo: massimizza prima il numero di slot
 * coperti, poi l'FVM totale della formazione.
 */

class MinCostFlow {
  private n: number
  private adj: number[][]
  private eTo: number[] = []
  private eCap: number[] = []
  private eCost: number[] = []

  constructor(n: number) {
    this.n = n
    this.adj = Array.from({ length: n }, () => [])
  }

  addEdge(u: number, v: number, cap: number, cost: number): void {
    this.adj[u].push(this.eTo.length)
    this.eTo.push(v)
    this.eCap.push(cap)
    this.eCost.push(cost)
    this.adj[v].push(this.eTo.length)
    this.eTo.push(u)
    this.eCap.push(0)
    this.eCost.push(-cost)
  }

  /** Cammini aumentanti più corti (SPFA): i costi sono negativi ma non ci sono cicli negativi. */
  run(s: number, t: number): void {
    for (;;) {
      const dist = new Array<number>(this.n).fill(Infinity)
      const inQueue = new Array<boolean>(this.n).fill(false)
      const prevEdge = new Array<number>(this.n).fill(-1)
      dist[s] = 0
      const queue: number[] = [s]
      inQueue[s] = true
      while (queue.length > 0) {
        const u = queue.shift()!
        inQueue[u] = false
        for (const e of this.adj[u]) {
          const v = this.eTo[e]
          if (this.eCap[e] > 0 && dist[u] + this.eCost[e] < dist[v] - 1e-9) {
            dist[v] = dist[u] + this.eCost[e]
            prevEdge[v] = e
            if (!inQueue[v]) {
              inQueue[v] = true
              queue.push(v)
            }
          }
        }
      }
      if (dist[t] === Infinity) return

      let push = Infinity
      for (let v = t; v !== s; v = this.eTo[prevEdge[v] ^ 1]) {
        push = Math.min(push, this.eCap[prevEdge[v]])
      }
      for (let v = t; v !== s; v = this.eTo[prevEdge[v] ^ 1]) {
        this.eCap[prevEdge[v]] -= push
        this.eCap[prevEdge[v] ^ 1] += push
      }
    }
  }

  /** Archi saturi uscenti da `u` verso i nodi nell'intervallo dato. */
  usedTarget(u: number, from: number, to: number): number | null {
    for (const e of this.adj[u]) {
      const v = this.eTo[e]
      if (v >= from && v < to && this.eCap[e] === 0 && e % 2 === 0) return v
    }
    return null
  }
}

export interface LineupSlot {
  slot: SlotDef
  player: Player | null
}

export interface LineupResult {
  module: ModuleDef
  slots: LineupSlot[]
  filled: number
  totalFvm: number
  /** Etichette degli slot rimasti scoperti */
  missing: string[]
}

export function bestLineup(module: ModuleDef, players: Player[], fvmOf: (p: Player) => number): LineupResult {
  const S = module.slots.length
  const P = players.length
  const source = 0
  const slotBase = 1
  const playerBase = slotBase + S
  const sink = playerBase + P
  const flow = new MinCostFlow(sink + 1)

  for (let i = 0; i < S; i++) flow.addEdge(source, slotBase + i, 1, 0)
  for (let j = 0; j < P; j++) flow.addEdge(playerBase + j, sink, 1, 0)
  for (let i = 0; i < S; i++) {
    const roles = module.slots[i].roles
    for (let j = 0; j < P; j++) {
      if (players[j].rm.some((r) => roles.includes(r))) {
        // +1 così anche un giocatore con FVM 0 conviene rispetto a lasciare lo slot vuoto
        flow.addEdge(slotBase + i, playerBase + j, 1, -(fvmOf(players[j]) + 1))
      }
    }
  }
  flow.run(source, sink)

  const slots: LineupSlot[] = []
  const missing: string[] = []
  let filled = 0
  let totalFvm = 0
  for (let i = 0; i < S; i++) {
    const node = flow.usedTarget(slotBase + i, playerBase, sink)
    const player = node === null ? null : players[node - playerBase]
    if (player) {
      filled++
      totalFvm += fvmOf(player)
    } else {
      missing.push(module.slots[i].label)
    }
    slots.push({ slot: module.slots[i], player })
  }
  return { module, slots, filled, totalFvm, missing }
}

export function bestLineups(
  modules: ModuleDef[],
  players: Player[],
  fvmOf: (p: Player) => number,
): LineupResult[] {
  return modules
    .map((m) => bestLineup(m, players, fvmOf))
    .sort((a, b) => b.filled - a.filled || b.totalFvm - a.totalFvm)
}
