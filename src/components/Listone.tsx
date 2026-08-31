import { useMemo, useRef, useState } from 'react'
import { playerFvm, playerQt, useStore } from '../store'
import type { Player } from '../types'
import { CLASSIC_ROLE_ORDER, MANTRA_ROLE_ORDER } from '../types'

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
}

type SortKey = 'fvm' | 'qt' | 'name'

export function Listone({ onPick }: { onPick: (p: Player) => void }) {
  const { state, dispatch, suggestions, purchaseByPlayer } = useStore()
  const { config } = state
  const [query, setQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState<string>('')
  const [teamFilter, setTeamFilter] = useState<string>('')
  const [hideSold, setHideSold] = useState(false)
  const [onlyTargets, setOnlyTargets] = useState(false)
  const [sortKey, setSortKey] = useState<SortKey>('fvm')
  const searchRef = useRef<HTMLInputElement>(null)

  const teams = useMemo(
    () => [...new Set(state.players.map((p) => p.team))].sort((a, b) => a.localeCompare(b)),
    [state.players],
  )

  const roles: string[] = useMemo(() => {
    if (config.mode === 'classic') return CLASSIC_ROLE_ORDER
    const present = new Set(state.players.flatMap((p) => p.rm))
    const known = MANTRA_ROLE_ORDER.filter((r) => present.has(r))
    const unknown = [...present].filter((r) => !MANTRA_ROLE_ORDER.includes(r)).sort()
    return [...known, ...unknown]
  }, [config.mode, state.players])

  const filtered = useMemo(() => {
    const q = normalize(query.trim())
    let list = state.players.filter((p) => !p.ceduto)
    if (q) list = list.filter((p) => normalize(p.name).includes(q))
    if (roleFilter) {
      list =
        config.mode === 'mantra'
          ? list.filter((p) => p.rm.includes(roleFilter))
          : list.filter((p) => p.r === roleFilter)
    }
    if (teamFilter) list = list.filter((p) => p.team === teamFilter)
    if (hideSold) list = list.filter((p) => !purchaseByPlayer.has(p.id))
    if (onlyTargets) list = list.filter((p) => state.targets[p.id])
    const mode = config.mode
    list = [...list].sort((a, b) => {
      if (sortKey === 'name') return a.name.localeCompare(b.name)
      if (sortKey === 'qt') return playerQt(b, mode) - playerQt(a, mode)
      return playerFvm(b, mode) - playerFvm(a, mode)
    })
    return list
  }, [state.players, state.targets, query, roleFilter, teamFilter, hideSold, onlyTargets, sortKey, config.mode, purchaseByPlayer])

  const teamName = (teamId: string) => config.teams.find((t) => t.id === teamId)?.name ?? '?'

  return (
    <div className="listone">
      <div className="listone-filters">
        <input
          ref={searchRef}
          className="search"
          placeholder="Cerca giocatore…  (Invio: apri il primo)"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && filtered.length > 0) onPick(filtered[0])
            if (e.key === 'Escape') setQuery('')
          }}
        />
        <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
          <option value="">Tutti i ruoli</option>
          {roles.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
        <select value={teamFilter} onChange={(e) => setTeamFilter(e.target.value)}>
          <option value="">Tutte le squadre</option>
          {teams.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <select value={sortKey} onChange={(e) => setSortKey(e.target.value as SortKey)}>
          <option value="fvm">Ordina: FVM</option>
          <option value="qt">Ordina: Quotazione</option>
          <option value="name">Ordina: Nome</option>
        </select>
        <label className="check">
          <input type="checkbox" checked={hideSold} onChange={(e) => setHideSold(e.target.checked)} />
          Nascondi presi
        </label>
        <label className="check">
          <input type="checkbox" checked={onlyTargets} onChange={(e) => setOnlyTargets(e.target.checked)} />
          Solo obiettivi ★
        </label>
      </div>

      <div className="listone-scroll">
        <table>
          <thead>
            <tr>
              <th></th>
              <th>Nome</th>
              <th>Squadra</th>
              <th>Ruolo</th>
              <th className="num">Qt.</th>
              <th className="num">FVM</th>
              <th className="num">Sugg.</th>
              <th>Stato</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => {
              const pu = purchaseByPlayer.get(p.id)
              const isTarget = !!state.targets[p.id]
              const rolesShown = config.mode === 'mantra' ? p.rm : [p.r]
              return (
                <tr
                  key={p.id}
                  className={`${pu ? 'sold' : ''} ${isTarget ? 'target' : ''}`}
                  onClick={() => onPick(p)}
                >
                  <td
                    className="star"
                    onClick={(e) => {
                      e.stopPropagation()
                      dispatch({ type: 'toggleTarget', playerId: p.id })
                    }}
                    title="Aggiungi/rimuovi dagli obiettivi"
                  >
                    {isTarget ? '★' : '☆'}
                  </td>
                  <td className="name">{p.name}</td>
                  <td className="muted">{p.team}</td>
                  <td>
                    <span className="badges">
                      {rolesShown.map((r) => (
                        <span key={r} className={`badge role-${r}`}>
                          {r}
                        </span>
                      ))}
                    </span>
                  </td>
                  <td className="num">{playerQt(p, config.mode)}</td>
                  <td className="num">{playerFvm(p, config.mode)}</td>
                  <td className="num suggest">{suggestions.get(p.id) ?? '—'}</td>
                  <td className="status">
                    {pu ? (
                      <span>
                        {teamName(pu.teamId)} · <b>{pu.price}</b>
                      </span>
                    ) : state.targets[p.id]?.maxPrice != null ? (
                      <span className="target-max">max {state.targets[p.id].maxPrice}</span>
                    ) : null}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {filtered.length === 0 && <p className="muted empty">Nessun giocatore trovato</p>}
      </div>
    </div>
  )
}
