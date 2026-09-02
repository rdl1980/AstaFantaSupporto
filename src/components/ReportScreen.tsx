import { useMemo, useState } from 'react'
import { repartoPlans } from '../analysis'
import { exportRoster, exportTabellone, rosterText } from '../exporters'
import { clubCoverage, deals, rosterRows, teamReports, timeline } from '../report'
import type { RosterRow } from '../report'
import { teamStats, useStore } from '../store'
import { MODE_LABEL } from '../types'

function Delta({ value }: { value: number }) {
  if (value === 0) return <span className="muted">in linea</span>
  const good = value < 0
  return (
    <span className={good ? 'ok' : 'over'}>
      {good ? '−' : '+'}
      {Math.abs(value)}
    </span>
  )
}

function DealList({ items, empty }: { items: RosterRow[]; empty: string }) {
  if (items.length === 0) return <p className="muted small">{empty}</p>
  return (
    <ul className="deal-list">
      {items.map((r) => (
        <li key={r.player.id}>
          <span className="deal-name">{r.player.name}</span>
          <span className="muted small">
            {r.price} vs {r.suggested}
          </span>
          <b>
            <Delta value={r.delta} />
          </b>
        </li>
      ))}
    </ul>
  )
}

export function ReportScreen({ onBack }: { onBack: () => void }) {
  const { state, suggestions, myTeamId, activeAuction } = useStore()
  const { config } = state
  const [copied, setCopied] = useState(false)
  const [timelineTeam, setTimelineTeam] = useState<string>('')

  const rows = useMemo(() => rosterRows(state, myTeamId, suggestions), [state, myTeamId, suggestions])
  const reports = useMemo(() => teamReports(state, suggestions), [state, suggestions])
  const events = useMemo(() => timeline(state, suggestions), [state, suggestions])
  const clubs = useMemo(() => clubCoverage(state, myTeamId, suggestions), [state, myTeamId, suggestions])
  const plans = useMemo(() => repartoPlans(state, myTeamId), [state, myTeamId])
  const { bargains, overpaid } = useMemo(() => deals(rows), [rows])

  const stats = teamStats(state, myTeamId)
  const totalSuggested = rows.reduce((s, r) => s + r.suggested, 0)
  const totalFvm = rows.reduce((s, r) => s + r.fvm, 0)
  const myRank = reports.findIndex((r) => r.team.id === myTeamId) + 1
  const shownEvents = timelineTeam ? events.filter((e) => e.purchase.teamId === timelineTeam) : events

  async function copyText() {
    try {
      await navigator.clipboard.writeText(rosterText(state, myTeamId, suggestions, activeAuction.name))
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch {
      // Clipboard negata (permessi o contesto non sicuro): resta il download
      setCopied(false)
    }
  }

  return (
    <div className="report">
      <header className="topbar">
        <div className="topbar-left">
          <button className="btn ghost" onClick={onBack}>
            ← Torna all&apos;asta
          </button>
          <h2 className="report-title">
            {activeAuction.name}{' '}
            <span className={`badge mode-badge ${config.mode}`}>{MODE_LABEL[config.mode].toUpperCase()}</span>
          </h2>
        </div>
        <div className="topbar-right">
          <button
            className="btn ghost"
            onClick={() => exportRoster(state, myTeamId, suggestions, activeAuction.name)}
            disabled={rows.length === 0}
          >
            ⬇ Excel rosa
          </button>
          <button
            className="btn ghost"
            onClick={() => exportTabellone(state, suggestions, activeAuction.name)}
            disabled={state.purchases.length === 0}
          >
            ⬇ Excel tabellone
          </button>
          <button className="btn ghost" onClick={copyText} disabled={rows.length === 0}>
            {copied ? '✔ copiata' : '📋 Rosa per chat'}
          </button>
        </div>
      </header>

      <div className="report-body">
        {state.purchases.length === 0 ? (
          <p className="muted empty">
            Nessun acquisto registrato: il report si popola man mano che assegni i giocatori.
          </p>
        ) : (
          <>
            <section className="card">
              <h3>La tua asta</h3>
              <div className="report-stats">
                <div className="stat">
                  <span className="muted">Giocatori</span>
                  <b className="big-num">{rows.length}</b>
                  <span className="muted small">su {stats.count + stats.slotsLeft}</span>
                </div>
                <div className="stat">
                  <span className="muted">Speso</span>
                  <b className="big-num">{stats.spent}</b>
                  <span className="muted small">su {config.budget}</span>
                </div>
                <div className="stat">
                  <span className="muted">Residuo</span>
                  <b>{stats.remaining}</b>
                </div>
                <div className="stat">
                  <span className="muted">Valore suggerito</span>
                  <b>{totalSuggested}</b>
                  <span className="small">
                    <Delta value={stats.spent - totalSuggested} />
                  </span>
                </div>
                <div className="stat">
                  <span className="muted">FVM rosa</span>
                  <b>{totalFvm}</b>
                </div>
                <div className="stat">
                  <span className="muted">Posizione per FVM</span>
                  <b className={myRank === 1 ? 'ok' : ''}>
                    {myRank}º<span className="muted small"> su {reports.length}</span>
                  </b>
                </div>
              </div>
              <p className="muted small">
                Il confronto è con il prezzo suggerito dall&apos;app, non con quanto valgono davvero: dice
                se hai comprato sopra o sotto la media della lega, non se hai fatto bene.
              </p>
            </section>

            <section className="card">
              <h3>Spesa per reparto</h3>
              <table className="report-table">
                <thead>
                  <tr>
                    <th>Reparto</th>
                    <th className="num">Presi</th>
                    <th className="num">Previsti</th>
                    <th className="num">Speso</th>
                    <th className="num">Piano</th>
                    <th className="num">Scostamento</th>
                    <th className="num">% del budget</th>
                  </tr>
                </thead>
                <tbody>
                  {plans.map((p) => (
                    <tr key={p.role}>
                      <td>
                        <span className={`badge role-${p.role}`}>{p.role}</span> {p.label}
                      </td>
                      <td className="num">{p.bought}</td>
                      <td className="num muted">{p.slots}</td>
                      <td className="num">
                        <b>{p.spent}</b>
                      </td>
                      <td className="num muted">{p.allocated}</td>
                      <td className="num">
                        <Delta value={p.spent - p.allocated} />
                      </td>
                      <td className="num">
                        {stats.spent > 0 ? Math.round((p.spent / stats.spent) * 100) : 0}%
                        <span className="muted small"> / {p.pct}%</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>

            <div className="report-cols">
              <section className="card">
                <h3>Affari</h3>
                <p className="muted small">Pagati meno del suggerito</p>
                <DealList items={bargains} empty="Nessun acquisto sotto il prezzo suggerito" />
              </section>
              <section className="card">
                <h3>Pagati cari</h3>
                <p className="muted small">Pagati più del suggerito</p>
                <DealList items={overpaid} empty="Nessun acquisto sopra il prezzo suggerito" />
              </section>
            </div>

            <section className="card">
              <h3>Confronto squadre</h3>
              <table className="report-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Squadra</th>
                    <th className="num">Giocatori</th>
                    <th className="num">Speso</th>
                    <th className="num">Residuo</th>
                    <th className="num">FVM totale</th>
                    <th className="num" title="FVM ottenuto per ogni credito speso">
                      FVM/credito
                    </th>
                    <th className="num">vs suggerito</th>
                  </tr>
                </thead>
                <tbody>
                  {reports.map((r, i) => (
                    <tr key={r.team.id} className={r.team.isMine ? 'won' : ''}>
                      <td className="muted">{i + 1}</td>
                      <td className="name">
                        {r.team.name} {r.team.isMine && <span className="badge current-badge">io</span>}
                      </td>
                      <td className="num">{r.rows.length}</td>
                      <td className="num">{r.totalSpent}</td>
                      <td className="num muted">{r.stats.remaining}</td>
                      <td className="num">
                        <b>{r.totalFvm}</b>
                      </td>
                      <td className="num">{r.fvmPerCredit.toFixed(2)}</td>
                      <td className="num">
                        <Delta value={r.delta} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="muted small">
                L&apos;FVM è la valutazione di fantacalcio.it a inizio stagione: una stima, non un verdetto.
              </p>
            </section>

            <section className="card">
              <h3>Copertura squadre di Serie A</h3>
              <p className="muted small">
                {clubs.length} club rappresentati. Troppi giocatori dello stesso club legano la tua giornata
                alla loro.
              </p>
              <div className="club-grid">
                {clubs.map((c) => (
                  <div key={c.club} className={`club-chip ${c.count >= 4 ? 'crowded' : ''}`}>
                    <b>{c.club}</b> <span className="muted">{c.count}</span>
                    <div className="muted small">{c.players.map((p) => p.name).join(', ')}</div>
                  </div>
                ))}
              </div>
            </section>

            <section className="card">
              <div className="split-head">
                <h3>La tua rosa</h3>
                <span className="muted small">{rows.length} giocatori, dal più caro</span>
              </div>
              <table className="report-table">
                <thead>
                  <tr>
                    <th>Nome</th>
                    <th>Club</th>
                    <th>Ruolo</th>
                    <th className="num">Prezzo</th>
                    <th className="num">Suggerito</th>
                    <th className="num">Scostamento</th>
                    <th className="num">FVM</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.player.id}>
                      <td className="name">{r.player.name}</td>
                      <td className="muted">{r.player.team}</td>
                      <td>
                        <span className="badges">
                          {(config.mode === 'mantra' ? r.player.rm : [r.player.r]).map((role) => (
                            <span key={role} className={`badge role-${role}`}>
                              {role}
                            </span>
                          ))}
                        </span>
                      </td>
                      <td className="num">
                        <b>{r.price}</b>
                      </td>
                      <td className="num muted">{r.suggested}</td>
                      <td className="num">
                        <Delta value={r.delta} />
                      </td>
                      <td className="num">{r.fvm}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>

            <section className="card">
              <div className="split-head">
                <h3>Cronologia dell&apos;asta</h3>
                <select value={timelineTeam} onChange={(e) => setTimelineTeam(e.target.value)}>
                  <option value="">Tutte le squadre</option>
                  {config.teams.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
              <table className="report-table">
                <thead>
                  <tr>
                    <th className="num">#</th>
                    <th>Ora</th>
                    <th>Giocatore</th>
                    <th>A</th>
                    <th className="num">Prezzo</th>
                    <th className="num">Scostamento</th>
                  </tr>
                </thead>
                <tbody>
                  {shownEvents.map((e) => (
                    <tr key={e.purchase.playerId} className={e.isMine ? 'won' : ''}>
                      <td className="num muted">{e.index}</td>
                      <td className="muted small">
                        {new Date(e.purchase.ts).toLocaleTimeString('it-IT', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="name">
                        {e.player.name} <span className="muted small">{e.player.team}</span>
                      </td>
                      <td>{e.teamName}</td>
                      <td className="num">
                        <b>{e.purchase.price}</b>
                      </td>
                      <td className="num">
                        <Delta value={e.delta} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="muted small">
                L&apos;orario è quello in cui hai registrato l&apos;acquisto nell&apos;app.
              </p>
            </section>
          </>
        )}
      </div>
    </div>
  )
}
