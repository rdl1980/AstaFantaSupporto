import { useMemo } from 'react'
import { teamStats, useStore } from '../store'
import type { Player } from '../types'
import { CLASSIC_ROLE_LABEL, CLASSIC_ROLE_ORDER, MANTRA_ROLE_ORDER } from '../types'

/**
 * Rosa della mia squadra raggruppata per ruolo.
 * In Mantra un giocatore multiruolo appare in tutte le caselle dei suoi ruoli.
 */
export function MyRoster({ onPick }: { onPick: (p: Player) => void }) {
  const { state, playersById, myTeamId } = useStore()
  const { config } = state
  const stats = teamStats(state, myTeamId)

  const myPlayers = useMemo(
    () =>
      state.purchases
        .filter((pu) => pu.teamId === myTeamId)
        .map((pu) => ({ pu, pl: playersById.get(pu.playerId) }))
        .filter((x): x is { pu: (typeof state.purchases)[0]; pl: Player } => !!x.pl),
    [state.purchases, myTeamId, playersById],
  )

  const groups = useMemo(() => {
    if (config.mode === 'classic') {
      return CLASSIC_ROLE_ORDER.map((r) => ({
        role: r,
        label: CLASSIC_ROLE_LABEL[r],
        quota: config.classicSlots[r] as number | null,
        items: myPlayers.filter((x) => x.pl.r === r),
      }))
    }
    const present = new Set(myPlayers.flatMap((x) => x.pl.rm))
    const order = [
      ...MANTRA_ROLE_ORDER,
      ...[...present].filter((r) => !MANTRA_ROLE_ORDER.includes(r)).sort(),
    ]
    return order
      .filter((r) => present.has(r) || r === 'Por')
      .map((r) => ({
        role: r,
        label: r,
        quota: r === 'Por' ? config.mantraGk : null,
        items: myPlayers.filter((x) => x.pl.rm.includes(r)),
      }))
  }, [config, myPlayers])

  return (
    <div className="my-roster">
      <div className="roster-summary">
        <div className="stat">
          <span className="muted">Residuo</span>
          <b className="big-num">{stats.remaining}</b>
        </div>
        <div className="stat">
          <span className="muted">Speso</span>
          <b>{stats.spent}</b>
        </div>
        <div className="stat">
          <span className="muted">Offerta max</span>
          <b>{stats.maxBid}</b>
        </div>
        {config.mode === 'mantra' ? (
          <>
            <div className="stat">
              <span className="muted">Portieri</span>
              <b className={stats.gkCount >= config.mantraGk ? 'full' : ''}>
                {stats.gkCount}/{config.mantraGk}
              </b>
            </div>
            <div className="stat">
              <span className="muted">Movimento</span>
              <b className={stats.outfieldCount >= config.mantraOutfield ? 'full' : ''}>
                {stats.outfieldCount}/{config.mantraOutfield}
              </b>
            </div>
          </>
        ) : (
          CLASSIC_ROLE_ORDER.map((r) => (
            <div className="stat" key={r}>
              <span className="muted">{r}</span>
              <b className={stats.classicCounts[r] >= config.classicSlots[r] ? 'full' : ''}>
                {stats.classicCounts[r]}/{config.classicSlots[r]}
              </b>
            </div>
          ))
        )}
      </div>

      <div className="roster-groups">
        {groups.map((g) => (
          <div className="roster-group" key={g.role}>
            <h4>
              <span className={`badge role-${g.role}`}>{g.role}</span> {g.label !== g.role ? g.label : ''}{' '}
              <span className="muted">
                {g.items.length}
                {g.quota != null ? `/${g.quota}` : ''}
              </span>
            </h4>
            {g.items.length === 0 ? (
              <p className="muted small">—</p>
            ) : (
              <ul>
                {g.items.map(({ pu, pl }) => (
                  <li key={pl.id} onClick={() => onPick(pl)}>
                    <span>
                      {pl.name} <span className="muted small">{pl.team}</span>
                      {config.mode === 'mantra' && pl.rm.length > 1 && (
                        <span className="muted small"> ({pl.rm.join(';')})</span>
                      )}
                    </span>
                    <b>{pu.price}</b>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
        {myPlayers.length === 0 && <p className="muted empty">Nessun acquisto ancora</p>}
      </div>
    </div>
  )
}
