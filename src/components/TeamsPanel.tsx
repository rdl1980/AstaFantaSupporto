import { teamStats, useStore } from '../store'
import type { Player } from '../types'
import { CLASSIC_ROLE_ORDER } from '../types'

export function TeamsPanel({ onPick }: { onPick: (p: Player) => void }) {
  const { state, dispatch, playersById } = useStore()
  const { config } = state

  return (
    <div className="teams-panel">
      {config.teams.map((t) => {
        const stats = teamStats(state, t.id)
        const purchases = state.purchases
          .filter((pu) => pu.teamId === t.id)
          .sort((a, b) => b.price - a.price)
        return (
          <div className={`team-card ${t.isMine ? 'mine' : ''}`} key={t.id}>
            <div className="team-card-head">
              <input
                value={t.name}
                onChange={(e) => dispatch({ type: 'renameTeam', teamId: t.id, name: e.target.value })}
              />
              <div className="team-nums">
                <span title="Crediti residui">
                  💰 <b>{stats.remaining}</b>
                </span>
                <span title="Giocatori presi / slot totali" className="muted">
                  {stats.count}/{stats.slotsLeft + stats.count}
                </span>
              </div>
            </div>
            <div className="team-roles muted small">
              {config.mode === 'mantra' ? (
                <>
                  Por {stats.gkCount}/{config.mantraGk} · Mov {stats.outfieldCount}/{config.mantraOutfield}
                </>
              ) : (
                CLASSIC_ROLE_ORDER.map((r) => (
                  <span key={r}>
                    {r} {stats.classicCounts[r]}/{config.classicSlots[r]}{' '}
                  </span>
                ))
              )}
              · max <b>{stats.maxBid}</b>
            </div>
            {purchases.length > 0 && (
              <ul className="team-players">
                {purchases.map((pu) => {
                  const pl = playersById.get(pu.playerId)
                  if (!pl) return null
                  return (
                    <li key={pu.playerId} onClick={() => onPick(pl)}>
                      <span>
                        <span className={`badge role-${config.mode === 'mantra' ? pl.rm[0] : pl.r}`}>
                          {config.mode === 'mantra' ? pl.rm.join(';') : pl.r}
                        </span>{' '}
                        {pl.name}
                      </span>
                      <b>{pu.price}</b>
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
