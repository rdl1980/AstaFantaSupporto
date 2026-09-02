import { useEffect, useMemo, useRef, useState } from 'react'
import { rankAmongRole } from '../analysis'
import { availableFor, maxBidFor, playerQt, useStore } from '../store'
import type { Player } from '../types'

/**
 * Barra della chiamata in corso: tiene sotto gli occhi il giocatore in
 * trattativa, il tuo tetto e chi può ancora rilanciare, e permette di
 * registrare l'assegnazione senza aprire il dialog.
 */
export function CallBar({ player, onClose }: { player: Player; onClose: () => void }) {
  const { state, dispatch, suggestions, purchaseByPlayer, myTeamId } = useStore()
  const { config } = state
  const existing = purchaseByPlayer.get(player.id)
  const target = state.targets[player.id]
  const [price, setPrice] = useState(existing ? String(existing.price) : '')
  const [teamId, setTeamId] = useState<string | null>(existing?.teamId ?? null)
  const priceRef = useRef<HTMLInputElement>(null)

  // Cambiando giocatore la barra riparte pulita, senza trascinare la chiamata precedente
  useEffect(() => {
    setPrice(existing ? String(existing.price) : '')
    setTeamId(existing?.teamId ?? null)
    priceRef.current?.focus()
    // Deve reagire al cambio di giocatore, non a ogni modifica dell'acquisto
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player.id])

  const priceNum = Number(price)
  const validPrice = Number.isFinite(priceNum) && priceNum >= 1
  const suggested = suggestions.get(player.id) ?? 0
  const roles = useMemo(() => (config.mode === 'mantra' ? player.rm : [player.r]), [config.mode, player])
  const rank = useMemo(() => rankAmongRole(state, player, roles[0]), [state, player, roles])

  const refundFor = (id: string) => (existing && existing.teamId === id ? existing.price : 0)
  const myMax = maxBidFor(state, myTeamId, refundFor(myTeamId))

  /** Avversari ordinati per quanto possono ancora offrire. */
  const rivals = useMemo(
    () =>
      config.teams
        .filter((t) => !t.isMine)
        .map((t) => ({ team: t, max: maxBidFor(state, t.id, refundFor(t.id)) }))
        .sort((a, b) => b.max - a.max),
    // refundFor dipende da existing, che deriva da state
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state, config.teams],
  )

  const overMe = validPrice ? rivals.filter((r) => r.max >= priceNum).length : rivals.length
  const overTarget = target?.maxPrice != null && validPrice && priceNum > target.maxPrice
  const overBudget =
    teamId !== null && validPrice ? priceNum > availableFor(state, teamId, refundFor(teamId)) : false

  function assign(id: string) {
    if (!validPrice) {
      priceRef.current?.focus()
      return
    }
    dispatch({ type: 'purchase', playerId: player.id, teamId: id, price: priceNum })
    onClose()
  }

  return (
    <div className="callbar">
      <div className="callbar-main">
        <div className="callbar-player">
          <span className="callbar-name">{player.name}</span>
          <span className="muted"> {player.team}</span>
          <span className="badges">
            {roles.map((r) => (
              <span key={r} className={`badge role-${r}`}>
                {r}
              </span>
            ))}
          </span>
        </div>

        <div className="callbar-facts small">
          <span>
            <span className="muted">Qt</span> <b>{playerQt(player, config.mode)}</b>
          </span>
          <span>
            <span className="muted">Sugg</span> <b className="suggest">{suggested || '—'}</b>
          </span>
          {target?.maxPrice != null && (
            <span>
              <span className="muted">Tuo max</span> <b className="target-max">{target.maxPrice}</b>
            </span>
          )}
          <span>
            <span className="muted">Puoi arrivare a</span> <b className="big-num">{myMax}</b>
          </span>
          <span className="muted">
            {rank.rank}º {roles[0]} su {rank.total}
          </span>
        </div>

        <input
          ref={priceRef}
          className="callbar-price"
          type="number"
          min={1}
          placeholder="prezzo"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && teamId) assign(teamId)
            if (e.key === 'Escape') onClose()
          }}
        />

        <div className="callbar-teams">
          {config.teams.map((t, i) => (
            <button
              key={t.id}
              className={`btn team-btn ${teamId === t.id ? 'selected' : ''} ${t.isMine ? 'mine' : ''}`}
              disabled={!validPrice}
              title={validPrice ? `Assegna a ${t.name}` : 'Inserisci prima il prezzo'}
              onClick={() => {
                setTeamId(t.id)
                assign(t.id)
              }}
            >
              <span className="key">{i + 1}</span> {t.name}
            </button>
          ))}
        </div>

        <div className="callbar-actions">
          {existing && (
            <button
              className="btn danger small-btn"
              onClick={() => {
                dispatch({ type: 'removePurchase', playerId: player.id })
                onClose()
              }}
            >
              Svincola
            </button>
          )}
          <button className="btn ghost" onClick={onClose} title="Chiudi la chiamata (Esc)">
            ✕
          </button>
        </div>
      </div>

      <div className="callbar-rivals small">
        {validPrice ? (
          <span className={overMe === 0 ? 'ok' : 'muted'}>
            {overMe === 0
              ? `✔ nessun avversario può arrivare a ${priceNum}`
              : `${overMe} avversari possono superare ${priceNum}:`}
          </span>
        ) : (
          <span className="muted">Offerta massima degli avversari:</span>
        )}
        {rivals.map((r) => (
          <span
            key={r.team.id}
            className={`rival ${validPrice && r.max < priceNum ? 'out' : ''}`}
            title={`${r.team.name} può arrivare a ${r.max}`}
          >
            {r.team.name} <b>{r.max}</b>
          </span>
        ))}
        {overTarget && <span className="warn">⚠ sopra il tuo max ({target!.maxPrice})</span>}
        {overBudget && <span className="error">⚠ oltre i crediti della squadra scelta</span>}
      </div>
    </div>
  )
}
