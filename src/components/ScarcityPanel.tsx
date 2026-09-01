import { useMemo, useState } from 'react'
import { computeScarcity, computeTeamStats, marketStats } from '../analysis'
import type { RoleScarcity } from '../analysis'
import { useStore } from '../store'
import type { Player } from '../types'

function fillClass(ratio: number): string {
  if (ratio <= 0.25) return 'critical'
  if (ratio <= 0.5) return 'low'
  return 'ok'
}

export function ScarcityPanel({ onPick }: { onPick: (p: Player) => void }) {
  const { state } = useStore()
  const [byScarcity, setByScarcity] = useState(false)

  const { market, roles } = useMemo(() => {
    const statsByTeam = computeTeamStats(state)
    return { market: marketStats(state, statsByTeam), roles: computeScarcity(state, statsByTeam) }
  }, [state])

  const critical = roles.filter((r) => r.highTotal > 0 && r.highLeft / r.highTotal <= 0.25)

  const shown = useMemo(() => {
    if (!byScarcity) return roles
    const ratio = (r: RoleScarcity) => (r.highTotal > 0 ? r.highLeft / r.highTotal : 1)
    return [...roles].sort((a, b) => ratio(a) - ratio(b))
  }, [roles, byScarcity])

  return (
    <div className="scarcity">
      <div className="market-box">
        <div className="market-row">
          <div className="stat">
            <span className="muted">Crediti in gioco</span>
            <b>{market.totalCredits}</b>
          </div>
          <div className="stat">
            <span className="muted">Slot da riempire</span>
            <b>{market.totalSlots}</b>
          </div>
          <div className="stat">
            <span className="muted">Media lega / slot</span>
            <b>{market.avgPerSlot.toFixed(1)}</b>
          </div>
          <div className="stat">
            <span className="muted">Tu / slot</span>
            <b className="big-num">{market.myPerSlot.toFixed(1)}</b>
          </div>
          <div className="stat">
            <span className="muted">Avversari / slot</span>
            <b>{market.oppPerSlot.toFixed(1)}</b>
          </div>
        </div>
        {market.edgePct !== null && (
          <p className={`market-edge ${market.edgePct >= 0 ? 'ok' : 'warn'}`}>
            {market.edgePct >= 0
              ? `Hai il ${market.edgePct}% di potere d'acquisto in più degli avversari: puoi permetterti di alzare.`
              : `Hai il ${Math.abs(market.edgePct)}% di potere d'acquisto in meno degli avversari: cerca occasioni, non aste al rialzo.`}
          </p>
        )}
      </div>

      {critical.length > 0 && (
        <p className="alert">
          ⚠ Fascia alta quasi esaurita: <b>{critical.map((r) => r.role).join(', ')}</b>
        </p>
      )}

      <label className="check scarcity-sort">
        <input type="checkbox" checked={byScarcity} onChange={(e) => setByScarcity(e.target.checked)} />
        Ordina per scarsità (i ruoli più a rischio in cima)
      </label>

      <div className="scarcity-list">
        {shown.map((r) => (
          <RoleCard key={r.role} data={r} onPick={onPick} />
        ))}
      </div>
    </div>
  )
}

function RoleCard({ data, onPick }: { data: RoleScarcity; onPick: (p: Player) => void }) {
  const highRatio = data.highTotal > 0 ? data.highLeft / data.highTotal : 1
  return (
    <div className={`scarcity-card ${fillClass(highRatio)}`}>
      <div className="scarcity-head">
        <span className={`badge role-${data.role}`}>{data.role}</span>
        <span className="muted small">
          {data.left}/{data.total} disponibili
        </span>
        {data.demand !== null && (
          <span className="small demand" title="Slot che la lega deve ancora riempire in questo ruolo">
            servono <b>{data.demand}</b>
            {data.teamsNeeding !== null && <span className="muted"> ({data.teamsNeeding} sq.)</span>}
          </span>
        )}
      </div>

      <div className="tiers">
        {data.tiers.map((t) => {
          const ratio = t.total > 0 ? t.left / t.total : 0
          return (
            <div className="tier" key={t.label}>
              <span className="tier-label muted small">{t.label}</span>
              <span className="tier-bar">
                <span className={`tier-fill ${fillClass(ratio)}`} style={{ width: `${ratio * 100}%` }} />
              </span>
              <span className="tier-count small">
                {t.left}/{t.total}
              </span>
            </div>
          )
        })}
      </div>

      {data.topLeft.length > 0 && (
        <div className="top-left small">
          <span className="muted">Migliori: </span>
          {data.topLeft.map((p, i) => (
            <span key={p.id}>
              {i > 0 && ', '}
              <span className="link" onClick={() => onPick(p)}>
                {p.name}
              </span>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
