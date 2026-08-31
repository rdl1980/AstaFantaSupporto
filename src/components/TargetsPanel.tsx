import { useMemo } from 'react'
import { playerFvm, useStore } from '../store'
import type { Player } from '../types'

export function TargetsPanel({ onPick }: { onPick: (p: Player) => void }) {
  const { state, dispatch, playersById, purchaseByPlayer, suggestions, myTeamId } = useStore()
  const { config } = state

  const targets = useMemo(() => {
    const list = Object.values(state.targets)
      .map((t) => ({ t, pl: playersById.get(t.playerId) }))
      .filter((x): x is { t: (typeof x)['t']; pl: Player } => !!x.pl)
    return list.sort((a, b) => {
      const soldA = purchaseByPlayer.has(a.pl.id) ? 1 : 0
      const soldB = purchaseByPlayer.has(b.pl.id) ? 1 : 0
      if (soldA !== soldB) return soldA - soldB
      return playerFvm(b.pl, config.mode) - playerFvm(a.pl, config.mode)
    })
  }, [state.targets, playersById, purchaseByPlayer, config.mode])

  const teamName = (teamId: string) => config.teams.find((t) => t.id === teamId)?.name ?? '?'

  if (targets.length === 0) {
    return <p className="muted empty">Nessun obiettivo: usa la stella ★ nel listone per aggiungerne</p>
  }

  return (
    <div className="targets-panel">
      <table>
        <thead>
          <tr>
            <th></th>
            <th>Nome</th>
            <th className="num">Sugg.</th>
            <th className="num">Max €</th>
            <th>Note</th>
            <th>Stato</th>
          </tr>
        </thead>
        <tbody>
          {targets.map(({ t, pl }) => {
            const pu = purchaseByPlayer.get(pl.id)
            const gone = pu && pu.teamId !== myTeamId
            const mine = pu && pu.teamId === myTeamId
            return (
              <tr key={pl.id} className={gone ? 'sold' : mine ? 'won' : ''}>
                <td
                  className="star"
                  onClick={() => dispatch({ type: 'toggleTarget', playerId: pl.id })}
                  title="Rimuovi dagli obiettivi"
                >
                  ★
                </td>
                <td className="name" onClick={() => onPick(pl)}>
                  {pl.name}{' '}
                  <span className="muted small">
                    {pl.team} · {config.mode === 'mantra' ? pl.rm.join(';') : pl.r}
                  </span>
                </td>
                <td className="num suggest">{suggestions.get(pl.id) ?? '—'}</td>
                <td className="num">
                  <input
                    className="max-price"
                    type="number"
                    min={1}
                    placeholder="—"
                    value={t.maxPrice ?? ''}
                    onChange={(e) =>
                      dispatch({
                        type: 'setTarget',
                        playerId: pl.id,
                        patch: { maxPrice: e.target.value === '' ? null : Number(e.target.value) },
                      })
                    }
                  />
                </td>
                <td>
                  <input
                    className="note"
                    placeholder="note…"
                    value={t.note}
                    onChange={(e) => dispatch({ type: 'setTarget', playerId: pl.id, patch: { note: e.target.value } })}
                  />
                </td>
                <td className="status">
                  {mine && <span className="ok">✔ preso a {pu.price}</span>}
                  {gone && (
                    <span>
                      {teamName(pu.teamId)} · {pu.price}
                    </span>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
