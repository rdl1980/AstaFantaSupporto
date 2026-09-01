import type { TargetDraft } from './nameMatch'
import type { AppState, Player } from './types'

/**
 * Formato JSON degli obiettivi. Tollerante di proposito: accetta un array
 * semplice oppure un oggetto con la chiave "targets", e ogni voce può essere
 * una stringa (solo il nome) o un oggetto.
 *
 * {
 *   "targets": [
 *     { "name": "Calhanoglu", "priority": 1, "maxPrice": 300, "note": "rigorista" },
 *     "Dimarco",
 *     { "id": 254, "priority": 2 }
 *   ]
 * }
 */

const PRIORITY_ALIASES: Record<string, number> = {
  '1': 1,
  p1: 1,
  prio1: 1,
  prio: 1,
  alta: 1,
  '2': 2,
  p2: 2,
  prio2: 2,
  media: 2,
  '3': 3,
  low: 3,
  bassa: 3,
  '4': 4,
  s: 4,
  scommessa: 4,
  scommesse: 4,
}

function toPriority(value: unknown): number | null {
  if (value == null) return null
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value === 'string') {
    const key = value.trim().toLowerCase().replace(/\s+/g, '')
    return PRIORITY_ALIASES[key] ?? null
  }
  return null
}

function toPrice(value: unknown): number | null {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null
}

export function parseTargetsJson(text: string): TargetDraft[] {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error('JSON non valido: controlla virgole e parentesi')
  }

  const list = Array.isArray(data)
    ? data
    : typeof data === 'object' && data !== null && Array.isArray((data as { targets?: unknown }).targets)
      ? ((data as { targets: unknown[] }).targets)
      : null
  if (!list) {
    throw new Error('Serve un array di obiettivi, oppure un oggetto con la chiave "targets"')
  }

  const drafts: TargetDraft[] = []
  for (const entry of list) {
    if (typeof entry === 'string') {
      const name = entry.trim()
      if (name) drafts.push({ label: name, query: name, maxPrice: null, priority: null, note: '' })
      continue
    }
    if (typeof entry !== 'object' || entry === null) continue
    const e = entry as Record<string, unknown>
    const name = typeof e.name === 'string' ? e.name.trim() : ''
    const id = typeof e.id === 'number' ? e.id : undefined
    if (!name && id == null) continue
    drafts.push({
      label: name || `id ${id}`,
      query: name,
      maxPrice: toPrice(e.maxPrice),
      priority: toPriority(e.priority),
      note: typeof e.note === 'string' ? e.note : '',
      id,
    })
  }
  if (drafts.length === 0) throw new Error('Nessun obiettivo valido trovato nel file')
  return drafts
}

export function serializeTargets(state: AppState, playersById: Map<number, Player>): string {
  const targets = Object.values(state.targets)
    .map((t) => ({ t, pl: playersById.get(t.playerId) }))
    .filter((x): x is { t: (typeof x)['t']; pl: Player } => !!x.pl)
    .sort((a, b) => (a.t.priority ?? 9) - (b.t.priority ?? 9) || a.pl.name.localeCompare(b.pl.name))
    .map(({ t, pl }) => ({
      name: pl.name,
      id: pl.id,
      squadra: pl.team,
      ruoli: state.config.mode === 'mantra' ? pl.rm.join(';') : pl.r,
      priority: t.priority,
      maxPrice: t.maxPrice,
      note: t.note,
    }))
  return JSON.stringify({ versione: 1, targets }, null, 2)
}
