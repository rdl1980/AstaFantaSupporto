import { useState } from 'react'
import { useStore } from '../store'
import type { Mode } from '../types'
import { MAX_PARTECIPANTI, MIN_PARTECIPANTI, MODE_LABEL, otherMode } from '../types'

function autoName(mode: Mode): string {
  return `Asta ${MODE_LABEL[mode]}`
}

/** Dialog di creazione: parte già impostato sulla modalità opposta a quella corrente. */
export function NewAuctionDialog({ onClose }: { onClose: () => void }) {
  const { state, dispatch, activeAuction } = useStore()
  const suggested = otherMode(state.config.mode)
  const [mode, setMode] = useState<Mode>(suggested)
  const [name, setName] = useState(autoName(suggested))
  const [nameTouched, setNameTouched] = useState(false)
  const [copyConfig, setCopyConfig] = useState(true)
  const [teamCount, setTeamCount] = useState(state.config.teams.length)
  const [copyListone, setCopyListone] = useState(state.players.length > 0)
  const [copyTargets, setCopyTargets] = useState(false)

  function changeMode(next: Mode) {
    setMode(next)
    if (!nameTouched) setName(autoName(next))
  }

  const targetCount = Object.keys(state.targets).length
  const countValido =
    Number.isInteger(teamCount) && teamCount >= MIN_PARTECIPANTI && teamCount <= MAX_PARTECIPANTI

  return (
    <div className="dialog-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="dialog">
        <div className="dialog-head">
          <h3>Nuova asta</h3>
          <button className="btn ghost" onClick={onClose}>
            ✕
          </button>
        </div>

        <p className="muted small">
          L&apos;asta corrente (<b>{activeAuction.name}</b>) resta salvata: potrai tornarci quando vuoi.
        </p>

        <label className="price-label">
          Nome
          <input
            className="auction-name-input"
            value={name}
            autoFocus
            onChange={(e) => {
              setName(e.target.value)
              setNameTouched(true)
            }}
          />
        </label>

        <label className="price-label">
          Numero di partecipanti
          <input
            className="auction-name-input"
            type="number"
            min={MIN_PARTECIPANTI}
            max={MAX_PARTECIPANTI}
            value={teamCount}
            onChange={(e) => setTeamCount(Number(e.target.value))}
          />
        </label>
        {/* Si lascia scrivere qualsiasi cifra e si blocca la creazione: correggere
            il numero mentre lo si digita darebbe l'impressione di un campo impazzito. */}
        {countValido ? (
          <p className="muted small">
            Da {MIN_PARTECIPANTI} a {MAX_PARTECIPANTI}. <b>Si sceglie adesso e non si cambia più</b>: i
            nomi delle squadre restano invece modificabili quando vuoi.
          </p>
        ) : (
          <p className="error small">
            Servono da {MIN_PARTECIPANTI} a {MAX_PARTECIPANTI} partecipanti.
          </p>
        )}

        <div className="mode-choice">
          <span className="muted small">Modalità</span>
          <div className="mode-buttons">
            {(['mantra', 'classic'] as Mode[]).map((m) => (
              <button
                key={m}
                className={`btn ${mode === m ? 'primary' : ''}`}
                onClick={() => changeMode(m)}
              >
                {MODE_LABEL[m]}
                {m === suggested && <span className="muted small"> · opposta</span>}
              </button>
            ))}
          </div>
        </div>

        <div className="copy-choices">
          <span className="muted small">Cosa riportare dall&apos;asta corrente</span>
          <label className="check">
            <input type="checkbox" checked={copyConfig} onChange={(e) => setCopyConfig(e.target.checked)} />
            Squadre, budget e regole
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={copyListone}
              disabled={state.players.length === 0}
              onChange={(e) => {
                setCopyListone(e.target.checked)
                if (!e.target.checked) setCopyTargets(false)
              }}
            />
            Listone importato{state.players.length > 0 ? ` (${state.players.length} giocatori)` : ' (nessuno)'}
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={copyTargets}
              disabled={!copyListone || targetCount === 0}
              onChange={(e) => setCopyTargets(e.target.checked)}
            />
            Obiettivi ({targetCount})
          </label>
          <p className="muted small">Gli acquisti non vengono mai riportati: la nuova asta parte da zero.</p>
        </div>

        <div className="dialog-actions">
          <button className="btn ghost" onClick={onClose}>
            Annulla
          </button>
          <button
            className="btn primary"
            disabled={!countValido}
            onClick={() => {
              dispatch({
                type: 'createAuction',
                name,
                mode,
                teamCount,
                copyConfig,
                copyListone,
                copyTargets,
              })
              onClose()
            }}
          >
            Crea e apri
          </button>
        </div>
      </div>
    </div>
  )
}

/** Selettore compatto per la barra in alto. */
export function AuctionPicker() {
  const { dispatch, auctions, activeAuction } = useStore()
  const [creating, setCreating] = useState(false)

  return (
    <>
      <div className="auction-picker">
        <select
          value={activeAuction.id}
          title="Cambia asta"
          onChange={(e) => dispatch({ type: 'switchAuction', id: e.target.value })}
        >
          {auctions.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name} · {MODE_LABEL[a.state.config.mode]}
            </option>
          ))}
        </select>
        <button className="btn ghost" onClick={() => setCreating(true)} title="Crea una nuova asta">
          ＋
        </button>
      </div>
      {creating && <NewAuctionDialog onClose={() => setCreating(false)} />}
    </>
  )
}

/** Gestione completa, nella schermata di setup. */
export function AuctionsCard() {
  const { dispatch, auctions, activeAuction } = useStore()
  const [creating, setCreating] = useState(false)

  return (
    <section className="card">
      <div className="split-head">
        <h2>Aste salvate</h2>
        <button className="btn primary small-btn" onClick={() => setCreating(true)}>
          ＋ Nuova asta
        </button>
      </div>
      <p className="muted">
        Ogni asta tiene le sue regole, il suo listone e i suoi acquisti. Passare da una all&apos;altra non
        perde nulla.
      </p>

      <ul className="auctions-list">
        {auctions.map((a) => {
          const isActive = a.id === activeAuction.id
          const s = a.state
          return (
            <li key={a.id} className={isActive ? 'active' : ''}>
              <span className={`badge mode-badge ${s.config.mode}`}>
                {MODE_LABEL[s.config.mode].toUpperCase()}
              </span>
              <input
                className="auction-name"
                value={a.name}
                onChange={(e) => dispatch({ type: 'renameAuction', id: a.id, name: e.target.value })}
              />
              <span className="muted small auction-meta">
                {s.players.length > 0 ? `${s.players.length} giocatori` : 'nessun listone'} ·{' '}
                {s.purchases.length} acquisti · {new Date(a.updatedAt).toLocaleString('it-IT')}
              </span>
              <span className="auction-actions">
                {isActive ? (
                  <span className="badge current-badge">in uso</span>
                ) : (
                  <button className="btn ghost small-btn" onClick={() => dispatch({ type: 'switchAuction', id: a.id })}>
                    Apri
                  </button>
                )}
                <button
                  className="btn ghost small-btn"
                  title="Duplica questa asta"
                  onClick={() => dispatch({ type: 'duplicateAuction', id: a.id })}
                >
                  Duplica
                </button>
                <button
                  className="btn ghost small-btn danger-text"
                  disabled={auctions.length <= 1}
                  title={auctions.length <= 1 ? 'Non puoi eliminare l’unica asta' : 'Elimina questa asta'}
                  onClick={() => {
                    if (confirm(`Eliminare "${a.name}"? L'operazione non si può annullare.`)) {
                      dispatch({ type: 'deleteAuction', id: a.id })
                    }
                  }}
                >
                  Elimina
                </button>
              </span>
            </li>
          )
        })}
      </ul>

      {creating && <NewAuctionDialog onClose={() => setCreating(false)} />}
    </section>
  )
}
