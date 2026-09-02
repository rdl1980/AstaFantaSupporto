import * as XLSX from 'xlsx'
import { rosterRows, teamReports } from './report'
import type { RosterRow } from './report'
import { teamStats } from './store'
import type { AppState } from './types'
import { CLASSIC_ROLE_LABEL, CLASSIC_ROLE_ORDER, MODE_LABEL } from './types'

export function download(data: BlobPart, filename: string, type: string): void {
  const url = URL.createObjectURL(new Blob([data], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

/** Excel rifiuta alcuni caratteri nei nomi dei fogli e li tronca a 31. */
function sheetName(name: string, fallback: string): string {
  const clean = name.replace(/[[\]:*?/\\]/g, ' ').trim().slice(0, 31)
  return clean || fallback
}

function safeFileName(name: string): string {
  return name.replace(/[^\p{L}\p{N}\-_ ]/gu, '').trim().replace(/\s+/g, '-') || 'asta'
}

function rowsToAoa(state: AppState, rows: RosterRow[]): unknown[][] {
  const mantra = state.config.mode === 'mantra'
  const header = [
    'Nome',
    'Squadra',
    mantra ? 'Ruoli Mantra' : 'Ruolo',
    'Reparto',
    'Prezzo',
    'Suggerito',
    'Scostamento',
    'Quotazione',
    'FVM',
  ]
  const body = rows.map((r) => [
    r.player.name,
    r.player.team,
    mantra ? r.player.rm.join(';') : r.player.r,
    CLASSIC_ROLE_LABEL[r.player.r],
    r.price,
    r.suggested,
    r.delta,
    mantra ? r.player.qtAM : r.player.qtA,
    r.fvm,
  ])
  const totals = [
    'TOTALE',
    '',
    '',
    '',
    rows.reduce((s, r) => s + r.price, 0),
    rows.reduce((s, r) => s + r.suggested, 0),
    rows.reduce((s, r) => s + r.delta, 0),
    '',
    rows.reduce((s, r) => s + r.fvm, 0),
  ]
  return [header, ...body, [], totals]
}

function autoWidths(aoa: unknown[][]): { wch: number }[] {
  const widths: number[] = []
  for (const row of aoa) {
    row.forEach((cell, i) => {
      const len = String(cell ?? '').length
      if (len > (widths[i] ?? 0)) widths[i] = len
    })
  }
  return widths.map((w) => ({ wch: Math.min(Math.max(w + 2, 8), 40) }))
}

function addSheet(wb: XLSX.WorkBook, name: string, aoa: unknown[][]): void {
  const ws = XLSX.utils.aoa_to_sheet(aoa)
  ws['!cols'] = autoWidths(aoa)
  XLSX.utils.book_append_sheet(wb, ws, name)
}

function writeWorkbook(wb: XLSX.WorkBook, filename: string): void {
  const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer
  download(buf, filename, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
}

/** Excel della sola rosa indicata. */
export function exportRoster(
  state: AppState,
  teamId: string,
  suggestions: Map<number, number>,
  auctionName: string,
): void {
  const team = state.config.teams.find((t) => t.id === teamId)
  const rows = rosterRows(state, teamId, suggestions)
  const wb = XLSX.utils.book_new()
  addSheet(wb, sheetName(team?.name ?? 'Rosa', 'Rosa'), rowsToAoa(state, rows))
  writeWorkbook(wb, `${safeFileName(auctionName)}-${safeFileName(team?.name ?? 'rosa')}.xlsx`)
}

/** Excel con il tabellone completo: un foglio di riepilogo più uno per squadra. */
export function exportTabellone(
  state: AppState,
  suggestions: Map<number, number>,
  auctionName: string,
): void {
  const reports = teamReports(state, suggestions)
  const wb = XLSX.utils.book_new()

  const summary: unknown[][] = [
    ['Squadra', 'Giocatori', 'Speso', 'Residuo', 'Suggerito', 'Scostamento', 'FVM totale', 'FVM per credito'],
    ...reports.map((r) => [
      r.team.name + (r.team.isMine ? ' (io)' : ''),
      r.rows.length,
      r.totalSpent,
      r.stats.remaining,
      r.totalSuggested,
      r.delta,
      r.totalFvm,
      Number(r.fvmPerCredit.toFixed(3)),
    ]),
  ]
  addSheet(wb, 'Riepilogo', summary)

  const all: unknown[][] = [
    ['Squadra', 'Nome', 'Club', 'Ruolo', 'Reparto', 'Prezzo', 'Suggerito', 'Scostamento', 'FVM'],
  ]
  const mantra = state.config.mode === 'mantra'
  for (const r of reports) {
    for (const row of r.rows) {
      all.push([
        r.team.name,
        row.player.name,
        row.player.team,
        mantra ? row.player.rm.join(';') : row.player.r,
        CLASSIC_ROLE_LABEL[row.player.r],
        row.price,
        row.suggested,
        row.delta,
        row.fvm,
      ])
    }
  }
  addSheet(wb, 'Tutti gli acquisti', all)

  const used = new Set(['Riepilogo', 'Tutti gli acquisti'])
  reports.forEach((r, i) => {
    let name = sheetName(r.team.name, `Squadra ${i + 1}`)
    // I nomi dei fogli devono essere unici anche dopo il troncamento a 31 caratteri
    while (used.has(name)) name = sheetName(`${name.slice(0, 28)} ${i + 1}`, `Squadra ${i + 1}`)
    used.add(name)
    addSheet(wb, name, rowsToAoa(state, r.rows))
  })

  writeWorkbook(wb, `${safeFileName(auctionName)}-tabellone.xlsx`)
}

/** Rosa compatta da incollare in chat. */
export function rosterText(
  state: AppState,
  teamId: string,
  suggestions: Map<number, number>,
  auctionName: string,
): string {
  const team = state.config.teams.find((t) => t.id === teamId)
  const rows = rosterRows(state, teamId, suggestions)
  const stats = teamStats(state, teamId)
  const mantra = state.config.mode === 'mantra'

  const lines = [
    `${team?.name ?? 'Rosa'} — ${auctionName} (${MODE_LABEL[state.config.mode]})`,
    `${rows.length} giocatori · speso ${stats.spent}/${state.config.budget} · residuo ${stats.remaining}`,
    '',
  ]
  for (const r of CLASSIC_ROLE_ORDER) {
    const group = rows.filter((row) => row.player.r === r)
    if (group.length === 0) continue
    lines.push(`${CLASSIC_ROLE_LABEL[r].toUpperCase()} (${group.length})`)
    for (const row of group) {
      const roles = mantra ? ` [${row.player.rm.join(';')}]` : ''
      lines.push(`  ${row.player.name} (${row.player.team})${roles} — ${row.price}`)
    }
    lines.push('')
  }
  return lines.join('\n').trimEnd()
}
