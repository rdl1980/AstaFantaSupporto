import * as XLSX from 'xlsx'
import type { ClassicRole, Player } from './types'

/**
 * Parsa il file Quotazioni di fantacalcio.it.
 * Struttura attesa: foglio "Tutti" con riga titolo, poi header
 * Id | R | RM | Nome | Squadra | Qt.A | Qt.I | Diff. | Qt.A M | Qt.I M | Diff.M | FVM | FVM M
 * e foglio "Ceduti" con la stessa struttura per i giocatori non più utilizzabili.
 */
export interface ListoneResult {
  players: Player[]
  /** Numero di giocatori nel foglio Ceduti */
  cedutiCount: number
}

export function parseListone(data: ArrayBuffer): ListoneResult {
  const wb = XLSX.read(data, { type: 'array' })

  const tutti = wb.Sheets['Tutti']
  if (!tutti) throw new Error('Foglio "Tutti" non trovato: il file non sembra il listone quotazioni di fantacalcio.it')

  const cedutiIds = new Set<number>()
  const ceduti = wb.Sheets['Ceduti']
  if (ceduti) {
    for (const row of sheetRows(ceduti)) {
      const id = Number(row[0])
      if (Number.isFinite(id)) cedutiIds.add(id)
    }
  }

  const players: Player[] = []
  for (const row of sheetRows(tutti)) {
    const id = Number(row[0])
    if (!Number.isFinite(id)) continue
    const r = String(row[1] ?? '').trim() as ClassicRole
    if (!['P', 'D', 'C', 'A'].includes(r)) continue
    players.push({
      id,
      r,
      rm: String(row[2] ?? '')
        .split(';')
        .map((s) => s.trim())
        .filter(Boolean),
      name: String(row[3] ?? '').trim(),
      team: String(row[4] ?? '').trim(),
      qtA: num(row[5]),
      qtI: num(row[6]),
      qtAM: num(row[8]),
      qtIM: num(row[9]),
      fvm: num(row[11]),
      fvmM: num(row[12]),
      ceduto: cedutiIds.has(id),
    })
  }

  if (players.length === 0) throw new Error('Nessun giocatore trovato nel foglio "Tutti"')
  return { players, cedutiCount: cedutiIds.size }
}

function sheetRows(ws: XLSX.WorkSheet): unknown[][] {
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1 })
  // Salta titolo e header: le righe dati iniziano dove la prima colonna è un numero (Id)
  return rows.filter((r) => Number.isFinite(Number(r?.[0])) && r[0] !== null && r[0] !== '')
}

function num(v: unknown): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}
