import type { Player } from './types'

/**
 * Riconoscimento dei nomi incollati da un'altra lista (o trascritti da uno
 * screenshot) contro il listone di fantacalcio.it, che usa la forma
 * "Cognome I." — es. "Martinez L.", "Esposito F.P.", "Kolo Muani".
 */

export function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/['`.]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/** Separa "Martinez Jo." in cognome "Martinez" e iniziali ["Jo."]. */
export function splitPlayerName(name: string): { surname: string; initials: string[] } {
  const parts = name.trim().split(/\s+/)
  const initials: string[] = []
  while (parts.length > 1) {
    const last = parts[parts.length - 1]
    if (/^[\p{L}]{1,3}\.$/u.test(last) || /^(?:[\p{L}]\.)+$/u.test(last)) initials.unshift(parts.pop()!)
    else break
  }
  return { surname: parts.join(' '), initials }
}

function containsSeq(haystack: string[], needle: string[]): boolean {
  if (needle.length === 0) return false
  for (let i = 0; i + needle.length <= haystack.length; i++) {
    if (needle.every((t, j) => haystack[i + j] === t)) return true
  }
  return false
}

function score(p: Player, lineNorm: string, lineTokens: string[]): number {
  const full = norm(p.name)
  if (lineNorm === full) return 100

  const { surname, initials } = splitPlayerName(p.name)
  const surnameTokens = norm(surname).split(' ').filter(Boolean)
  if (!containsSeq(lineTokens, surnameTokens)) return 0

  let s = 50
  if (initials.length > 0) {
    const letters = norm(initials.join('')).replace(/\s+/g, '')
    const others = lineTokens.filter((t) => !surnameTokens.includes(t))
    if (letters && others.some((t) => t.startsWith(letters))) s += 35
    else if (letters && others.some((t) => t.startsWith(letters[0]))) s += 25
  } else {
    // Nessuna iniziale da confermare: il cognome da solo è già il nome intero.
    s += 10
  }
  const team = norm(p.team)
  if (team && lineNorm.includes(team)) s += 20
  return s
}

/** Un obiettivo da riconoscere, da qualsiasi fonte (riga di testo o voce JSON). */
export interface TargetDraft {
  /** Testo mostrato nella revisione */
  label: string
  /** Nome da cercare nel listone */
  query: string
  maxPrice: number | null
  priority: number | null
  note: string
  /** Id del listone: se presente si salta il riconoscimento per nome */
  id?: number
}

/** Accetta "Nome", "Nome = 250", "Nome: 250", "Nome | 250", "Nome - 250". */
export function parseLine(raw: string): TargetDraft | null {
  const line = raw.trim()
  if (!line) return null
  const m = line.match(/^(.+?)\s*(?:[=:|]|\s-)\s*(\d{1,4})\s*$/)
  if (m) return { label: line, query: m[1].trim(), maxPrice: Number(m[2]), priority: null, note: '' }
  return { label: line, query: line, maxPrice: null, priority: null, note: '' }
}

export type MatchStatus = 'ok' | 'ambiguous' | 'notfound'

export interface MatchResult {
  draft: TargetDraft
  status: MatchStatus
  /** Migliore corrispondenza (già selezionata) o null se non trovata */
  best: Player | null
  /** Alternative proposte, la migliore per prima */
  candidates: Player[]
}

export function matchDrafts(drafts: TargetDraft[], players: Player[]): MatchResult[] {
  const pool = players.filter((p) => !p.ceduto)
  const byId = new Map(pool.map((p) => [p.id, p]))
  const out: MatchResult[] = []

  for (const draft of drafts) {
    if (draft.id != null) {
      const p = byId.get(draft.id)
      out.push(
        p
          ? { draft, status: 'ok', best: p, candidates: [p] }
          : { draft, status: 'notfound', best: null, candidates: [] },
      )
      continue
    }

    const lineNorm = norm(draft.query)
    const lineTokens = lineNorm.split(' ').filter(Boolean)
    const scored = pool
      .map((p) => ({ p, s: score(p, lineNorm, lineTokens) }))
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s)

    if (scored.length === 0) {
      out.push({ draft, status: 'notfound', best: null, candidates: [] })
      continue
    }
    const top = scored[0].s
    const tied = scored.filter((x) => x.s === top)
    out.push({
      draft,
      status: tied.length > 1 ? 'ambiguous' : 'ok',
      best: scored[0].p,
      candidates: scored.slice(0, 6).map((x) => x.p),
    })
  }
  return out
}

export function matchLines(text: string, players: Player[]): MatchResult[] {
  const drafts = text
    .split(/\r?\n/)
    .map(parseLine)
    .filter((d): d is TargetDraft => d !== null)
  return matchDrafts(drafts, players)
}
