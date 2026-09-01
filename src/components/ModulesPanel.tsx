import { useMemo, useState } from 'react'
import { bestLineups } from '../lineup'
import { DEFAULT_MODULES_TEXT, parseModules } from '../modules'
import { playerFvm, useStore } from '../store'
import type { Player } from '../types'

export function ModulesPanel({ onPick }: { onPick: (p: Player) => void }) {
  const { state, dispatch, playersById, myTeamId } = useStore()
  const { config } = state
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(config.modulesText)

  const myPlayers = useMemo(
    () =>
      state.purchases
        .filter((pu) => pu.teamId === myTeamId)
        .map((pu) => playersById.get(pu.playerId))
        .filter((p): p is Player => !!p),
    [state.purchases, myTeamId, playersById],
  )

  const { modules, errors } = useMemo(() => parseModules(config.modulesText), [config.modulesText])

  const lineups = useMemo(
    () => bestLineups(modules, myPlayers, (p) => playerFvm(p, 'mantra')),
    [modules, myPlayers],
  )

  const bench = useMemo(() => {
    const best = lineups[0]
    if (!best) return []
    const used = new Set(best.slots.map((s) => s.player?.id).filter(Boolean))
    return myPlayers.filter((p) => !used.has(p.id)).sort((a, b) => playerFvm(b, 'mantra') - playerFvm(a, 'mantra'))
  }, [lineups, myPlayers])

  if (editing) {
    return (
      <div className="modules">
        <div className="split-head">
          <b>Tabella dei moduli</b>
          <button className="btn ghost small-btn" onClick={() => setEditing(false)}>
            ✕ chiudi
          </button>
        </div>
        <p className="muted small">
          Un modulo per riga: <code>Nome: slot, slot, …</code> con 11 slot. Uno slot che accetta più ruoli si
          scrive con la barra, es. <code>Dc/B</code>. Ruoli validi: Por, Ds, Dd, Dc, B, E, M, C, W, T, A, Pc.
        </p>
        <textarea
          className="import-text"
          rows={14}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          spellCheck={false}
        />
        {errors.length > 0 && (
          <ul className="module-errors small">
            {errors.map((e) => (
              <li key={e} className="error">
                {e}
              </li>
            ))}
          </ul>
        )}
        <div className="dialog-actions">
          <button className="btn ghost" onClick={() => setDraft(DEFAULT_MODULES_TEXT)}>
            Ripristina predefiniti
          </button>
          <button
            className="btn primary"
            onClick={() => {
              dispatch({ type: 'setConfig', patch: { modulesText: draft } })
              setEditing(false)
            }}
          >
            Salva
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="modules">
      <div className="modules-head">
        <span className="muted small">
          Miglior formazione possibile con i tuoi {myPlayers.length} giocatori, modulo per modulo.
        </span>
        <button
          className="btn ghost small-btn"
          onClick={() => {
            setDraft(config.modulesText)
            setEditing(true)
          }}
        >
          ✎ Modifica tabella
        </button>
      </div>

      {errors.length > 0 && (
        <p className="alert small">
          ⚠ {errors.length} righe della tabella non sono valide: aprila con “Modifica tabella”.
        </p>
      )}

      {myPlayers.length === 0 && <p className="muted empty">Nessun giocatore in rosa: registra i tuoi acquisti.</p>}

      <div className="modules-list">
        {lineups.map((lu) => {
          const complete = lu.filled === lu.module.slots.length
          return (
            <div className={`module-card ${complete ? 'complete' : ''}`} key={lu.module.name}>
              <div className="module-head">
                <b>{lu.module.name}</b>
                <span className={complete ? 'ok small' : 'warn small'}>
                  {complete ? '✔ completo' : `${lu.filled}/${lu.module.slots.length}`}
                </span>
                <span className="module-fvm small">
                  <span className="muted">FVM </span>
                  <b>{lu.totalFvm}</b>
                </span>
              </div>
              {lu.missing.length > 0 && (
                <div className="small warn module-missing">manca: {lu.missing.join(', ')}</div>
              )}
              <ul className="module-slots">
                {lu.slots.map((s, i) => (
                  <li key={`${s.slot.label}-${i}`} className={s.player ? '' : 'empty-slot'}>
                    <span className={`badge role-${s.slot.roles[0]}`}>{s.slot.label}</span>
                    {s.player ? (
                      <span className="module-player" onClick={() => onPick(s.player!)}>
                        {s.player.name}
                        <span className="muted small"> {playerFvm(s.player, 'mantra')}</span>
                      </span>
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )
        })}
      </div>

      {bench.length > 0 && (
        <div className="bench">
          <h4 className="small muted">Fuori dal miglior undici ({lineups[0]?.module.name})</h4>
          <div className="bench-list small">
            {bench.map((p, i) => (
              <span key={p.id}>
                {i > 0 && ' · '}
                <span className="link" onClick={() => onPick(p)}>
                  {p.name}
                </span>
                <span className="muted"> {p.rm.join(';')}</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
