import { useEffect, useRef, useState } from 'react'
import { playerQt, teamStats, useStore } from '../store'
import type { Player } from '../types'

export function PurchaseDialog({ player, onClose }: { player: Player; onClose: () => void }) {
  const { state, dispatch, suggestions, purchaseByPlayer, myTeamId } = useStore()
  const existing = purchaseByPlayer.get(player.id)
  const target = state.targets[player.id]
  const [price, setPrice] = useState<string>(existing ? String(existing.price) : '')
  const [teamId, setTeamId] = useState<string | null>(existing ? existing.teamId : null)
  const priceRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    priceRef.current?.focus()
    priceRef.current?.select()
  }, [])

  const suggested = suggestions.get(player.id)
  const myStats = teamStats(state, myTeamId)
  const priceNum = Number(price)
  const canConfirm = teamId !== null && Number.isFinite(priceNum) && priceNum >= 1

  function confirm() {
    if (!canConfirm || teamId === null) return
    dispatch({ type: 'purchase', playerId: player.id, teamId, price: priceNum })
    onClose()
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
      // 1-9: selezione rapida squadra
      const n = Number(e.key)
      if (n >= 1 && n <= state.config.teams.length && (e.target as HTMLElement)?.tagName !== 'INPUT') {
        setTeamId(state.config.teams[n - 1].id)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, state.config.teams])

  const roleBadges = state.config.mode === 'mantra' ? player.rm : [player.r]

  return (
    <div className="dialog-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="dialog">
        <div className="dialog-head">
          <div>
            <h3>
              {player.name} <span className="muted">· {player.team}</span>
            </h3>
            <div className="badges">
              {roleBadges.map((r) => (
                <span key={r} className={`badge role-${r}`}>
                  {r}
                </span>
              ))}
              {player.ceduto && <span className="badge ceduto">CEDUTO</span>}
            </div>
          </div>
          <button className="btn ghost" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="dialog-stats">
          <div>
            <span className="muted">Qt.</span> <b>{playerQt(player, state.config.mode)}</b>
          </div>
          <div>
            <span className="muted">Suggerito</span> <b className="suggest">{suggested ?? '—'}</b>
          </div>
          {target?.maxPrice != null && (
            <div>
              <span className="muted">Tuo max</span> <b className="target-max">{target.maxPrice}</b>
            </div>
          )}
          <div>
            <span className="muted">Tua offerta max</span> <b>{myStats.maxBid}</b>
          </div>
        </div>

        <label className="price-label">
          Prezzo di acquisto
          <input
            ref={priceRef}
            type="number"
            min={1}
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && confirm()}
          />
        </label>
        {target?.maxPrice != null && Number.isFinite(priceNum) && priceNum > target.maxPrice && (
          <p className="warn">⚠ Sopra il tuo prezzo massimo ({target.maxPrice})</p>
        )}

        <div className="team-pick">
          <span className="muted">Assegna a (tasti 1-{state.config.teams.length}):</span>
          <div className="team-buttons">
            {state.config.teams.map((t, i) => {
              const ts = teamStats(state, t.id)
              return (
                <button
                  key={t.id}
                  className={`btn team-btn ${teamId === t.id ? 'selected' : ''} ${t.isMine ? 'mine' : ''}`}
                  onClick={() => setTeamId(t.id)}
                  title={`Residuo: ${ts.remaining}`}
                >
                  <span className="key">{i + 1}</span> {t.name}
                  <span className="muted small"> · {ts.remaining}</span>
                </button>
              )
            })}
          </div>
        </div>

        <div className="dialog-actions">
          {existing && (
            <button
              className="btn danger"
              onClick={() => {
                dispatch({ type: 'removePurchase', playerId: player.id })
                onClose()
              }}
            >
              Svincola
            </button>
          )}
          <button className="btn primary" disabled={!canConfirm} onClick={confirm}>
            {existing ? 'Aggiorna' : 'Conferma'} {teamId === myTeamId && '(mio!)'}
          </button>
        </div>
      </div>
    </div>
  )
}
