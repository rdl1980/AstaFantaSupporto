import { MANTRA_ROLE_ORDER } from './types'

/**
 * Moduli Mantra: uno per riga, "Nome: slot, slot, ...", 11 slot ciascuno.
 * Uno slot con più ruoli alternativi si scrive con la barra, es. "Dc/B".
 *
 * Questi valori ricalcano la tabella ufficiale Mantra Experience: sono
 * modificabili dall'app (sezione Moduli) se la tua lega usa una tabella diversa
 * o se un accoppiamento non corrisponde.
 */
export const DEFAULT_MODULES_TEXT = `3-4-3: Por, Dc, Dc, Dc/B, E, M/C, C, E, W/A, W/A, A/Pc
3-4-1-2: Por, Dc, Dc, Dc/B, E, M/C, C, E, T, A/Pc, A/Pc
3-4-2-1: Por, Dc, Dc, Dc/B, E, M/C, C, E, E/W, T/A, A/Pc
3-5-2: Por, Dc, Dc, Dc/B, E, M, M/C, C, E, A/Pc, A/Pc
3-5-1-1: Por, Dc, Dc, Dc/B, E/W, M, M/C, C, E/W, T/A, A/Pc
4-3-3: Por, Dd, Dc, Dc, Ds, M/C, M, C, W/A, W/A, A/Pc
4-3-1-2: Por, Dd, Dc, Dc, Ds, M/C, M, C, T, A/Pc, A/Pc
4-4-2: Por, Dd, Dc, Dc, Ds, E/W, M/C, C, E, A/Pc, A/Pc
4-1-4-1: Por, Dd, Dc, Dc, Ds, M, E/W, C/T, T, E/W, A/Pc
4-4-1-1: Por, Dd, Dc, Dc, Ds, E/W, M/C, C, E, T/A, A/Pc
4-2-3-1: Por, Dd, Dc, Dc, Ds, M, M, W/T, T, W/A, A/Pc`

export interface SlotDef {
  /** Come appare nella tabella, es. "Dc/B" */
  label: string
  roles: string[]
}

export interface ModuleDef {
  name: string
  slots: SlotDef[]
}

const CANONICAL = new Map(MANTRA_ROLE_ORDER.map((r) => [r.toLowerCase(), r]))

export interface ParsedModules {
  modules: ModuleDef[]
  errors: string[]
}

export function parseModules(text: string): ParsedModules {
  const modules: ModuleDef[] = []
  const errors: string[] = []

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const sep = line.indexOf(':')
    if (sep < 0) {
      errors.push(`"${line}": manca il ":" tra nome e slot`)
      continue
    }
    const name = line.slice(0, sep).trim()
    const slots: SlotDef[] = []
    let bad = false
    for (const token of line.slice(sep + 1).split(',')) {
      const label = token.trim()
      if (!label) continue
      const roles: string[] = []
      for (const part of label.split('/')) {
        const role = CANONICAL.get(part.trim().toLowerCase())
        if (!role) {
          errors.push(`${name}: ruolo "${part.trim()}" non riconosciuto`)
          bad = true
          break
        }
        roles.push(role)
      }
      if (bad) break
      slots.push({ label, roles })
    }
    if (bad) continue
    if (slots.length !== 11) {
      errors.push(`${name}: ${slots.length} slot invece di 11`)
      continue
    }
    modules.push({ name, slots })
  }
  return { modules, errors }
}
