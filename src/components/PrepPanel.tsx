import { useMemo, useState } from 'react'
import { repartoPlans } from '../analysis'
import { playerFvm, useStore } from '../store'
import { ImportTargets } from './ImportTargets'
import type { ClassicRole, Player, Target } from '../types'
import { CLASSIC_ROLE_ORDER } from '../types'

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
}

export function PrepPanel({ onPick }: { onPick: (p: Player) => void }) {
  const { state, dispatch, playersById, purchaseByPlayer, suggestions, myTeamId } = useStore()
  const { config } = state
  const [query, setQuery] = useState('')

  const plans = useMemo(() => repartoPlans(state, myTeamId), [state, myTeamId])
  const pctSum = CLASSIC_ROLE_ORDER.reduce((s, r) => s + (config.budgetSplit[r] ?? 0), 0)
  const planSlotsSum = CLASSIC_ROLE_ORDER.reduce((s, r) => s + config.mantraPlanSlots[r], 0)
  const mantraSlotsTotal = config.mantraGk + config.mantraOutfield

  const matches = useMemo(() => {
    const q = normalize(query.trim())
    if (q.length < 2) return []
    return state.players
      .filter((p) => !p.ceduto && normalize(p.name).includes(q))
      .sort((a, b) => playerFvm(b, config.mode) - playerFvm(a, config.mode))
      .slice(0, 6)
  }, [query, state.players, config.mode])

  /** Obiettivi del reparto: prima i disponibili (per FVM), poi quelli già assegnati. */
  const targetsByRole = useMemo(() => {
    const map = new Map<ClassicRole, { t: Target; pl: Player }[]>()
    for (const r of CLASSIC_ROLE_ORDER) map.set(r, [])
    for (const t of Object.values(state.targets)) {
      const pl = playersById.get(t.playerId)
      if (!pl) continue
      map.get(pl.r)?.push({ t, pl })
    }
    for (const list of map.values()) {
      list.sort((a, b) => {
        const soldA = purchaseByPlayer.has(a.pl.id) ? 1 : 0
        const soldB = purchaseByPlayer.has(b.pl.id) ? 1 : 0
        if (soldA !== soldB) return soldA - soldB
        return playerFvm(b.pl, config.mode) - playerFvm(a.pl, config.mode)
      })
    }
    return map
  }, [state.targets, playersById, purchaseByPlayer, config.mode])

  const teamName = (teamId: string) => config.teams.find((t) => t.id === teamId)?.name ?? '?'

  return (
    <div className="prep">
      <div className="quick-add">
        <input
          placeholder="Aggiungi obiettivo: cerca un giocatore…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Escape' && setQuery('')}
        />
        {matches.length > 0 && (
          <ul className="quick-results">
            {matches.map((p) => {
              const isTarget = !!state.targets[p.id]
              return (
                <li key={p.id}>
                  <span>
                    <span className={`badge role-${config.mode === 'mantra' ? p.rm[0] : p.r}`}>
                      {config.mode === 'mantra' ? p.rm.join(';') : p.r}
                    </span>{' '}
                    {p.name} <span className="muted small">{p.team}</span>
                  </span>
                  <button
                    className="btn small-btn"
                    onClick={() => {
                      if (!isTarget) dispatch({ type: 'toggleTarget', playerId: p.id })
                      setQuery('')
                    }}
                  >
                    {isTarget ? '★ già obiettivo' : '+ obiettivo'}
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <ImportTargets />

      <div className="split-box">
        <div className="split-head">
          <b>Piano di spesa</b>
          <span className={pctSum === 100 ? 'muted small' : 'warn small'}>
            {pctSum}% allocato{pctSum !== 100 ? ' (dovrebbe essere 100%)' : ''}
          </span>
        </div>
        <div className="split-row">
          {plans.map((p) => (
            <label key={p.role} className="split-cell">
              <span className={`badge role-${p.role}`}>{p.role}</span>
              <input
                type="number"
                min={0}
                max={100}
                value={config.budgetSplit[p.role] ?? 0}
                onChange={(e) =>
                  dispatch({
                    type: 'setConfig',
                    patch: { budgetSplit: { ...config.budgetSplit, [p.role]: Number(e.target.value) || 0 } },
                  })
                }
              />
              <span className="muted small">% = {p.allocated}</span>
            </label>
          ))}
        </div>
        {config.mode === 'mantra' && (
          <div className="split-row">
            <span className="muted small plan-label">Giocatori previsti per reparto:</span>
            {CLASSIC_ROLE_ORDER.filter((r) => r !== 'P').map((r) => (
              <label key={r} className="split-cell">
                <span className={`badge role-${r}`}>{r}</span>
                <input
                  type="number"
                  min={0}
                  value={config.mantraPlanSlots[r]}
                  onChange={(e) =>
                    dispatch({
                      type: 'setConfig',
                      patch: { mantraPlanSlots: { ...config.mantraPlanSlots, [r]: Number(e.target.value) || 0 } },
                    })
                  }
                />
              </label>
            ))}
            <span className={planSlotsSum === mantraSlotsTotal ? 'muted small' : 'warn small'}>
              tot {planSlotsSum}/{mantraSlotsTotal}
            </span>
          </div>
        )}
      </div>

      {plans.map((plan) => {
        const list = targetsByRole.get(plan.role) ?? []
        const budgetLeft = plan.allocated - plan.spent
        const slotsLeft = Math.max(0, plan.slots - plan.bought)
        const overTargets = plan.targetsSum > budgetLeft && budgetLeft >= 0
        const spentRatio = plan.allocated > 0 ? Math.min(1, plan.spent / plan.allocated) : 0
        return (
          <div className="reparto-card" key={plan.role}>
            <div className="reparto-head">
              <span className={`badge role-${plan.role}`}>{plan.role}</span>
              <b>{plan.label}</b>
              <span className="muted small">
                {plan.bought}/{plan.slots} presi
              </span>
              <span className="reparto-budget small">
                <b className={budgetLeft < 0 ? 'error' : ''}>{budgetLeft}</b>
                <span className="muted"> di {plan.allocated} liberi</span>
              </span>
            </div>
            <span className="tier-bar wide">
              <span
                className={`tier-fill ${plan.spent > plan.allocated ? 'critical' : 'ok'}`}
                style={{ width: `${spentRatio * 100}%` }}
              />
            </span>
            <div className="reparto-meta small muted">
              {slotsLeft} slot da riempire · {plan.targetsOpen} obiettivi liberi
              {plan.targetsOpen > 0 && (
                <>
                  {' '}
                  · somma max <b className={overTargets ? 'warn' : ''}>{plan.targetsSum}</b>
                  {plan.targetsNoPrice > 0 && ` (${plan.targetsNoPrice} senza prezzo)`}
                </>
              )}
            </div>
            {overTargets && (
              <p className="warn small">
                ⚠ I prezzi massimi degli obiettivi superano di {plan.targetsSum - budgetLeft} il budget del reparto
              </p>
            )}
            {plan.targetsOpen < slotsLeft && (
              <p className="muted small">
                Ti mancano obiettivi: {slotsLeft} slot da riempire, {plan.targetsOpen} obiettivi in lista
              </p>
            )}

            {list.length > 0 && (
              <ul className="target-list">
                {list.map(({ t, pl }) => {
                  const pu = purchaseByPlayer.get(pl.id)
                  const mine = pu && pu.teamId === myTeamId
                  const gone = pu && !mine
                  return (
                    <li key={pl.id} className={gone ? 'sold' : mine ? 'won' : ''}>
                      <span className="t-star" onClick={() => dispatch({ type: 'toggleTarget', playerId: pl.id })}>
                        ★
                      </span>
                      <span className="t-name" onClick={() => onPick(pl)}>
                        {pl.name}{' '}
                        <span className="muted small">
                          {pl.team}
                          {config.mode === 'mantra' && ` · ${pl.rm.join(';')}`}
                        </span>
                      </span>
                      <span className="t-sugg suggest small" title="Prezzo suggerito">
                        {suggestions.get(pl.id) ?? '—'}
                      </span>
                      <input
                        className="t-max"
                        type="number"
                        min={1}
                        placeholder="max"
                        value={t.maxPrice ?? ''}
                        onChange={(e) =>
                          dispatch({
                            type: 'setTarget',
                            playerId: pl.id,
                            patch: { maxPrice: e.target.value === '' ? null : Number(e.target.value) },
                          })
                        }
                      />
                      <span className="t-status small">
                        {mine && <span className="ok">✔ {pu.price}</span>}
                        {gone && (
                          <span className="muted">
                            {teamName(pu.teamId)} {pu.price}
                          </span>
                        )}
                      </span>
                      <input
                        className="t-note"
                        placeholder="nota…"
                        value={t.note}
                        onChange={(e) => dispatch({ type: 'setTarget', playerId: pl.id, patch: { note: e.target.value } })}
                      />
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        )
      })}
    </div>
  )
}
