import { useState } from 'react'
import { matchLines } from '../nameMatch'
import type { MatchResult } from '../nameMatch'
import { useStore } from '../store'

const PLACEHOLDER = `Un giocatore per riga. Il prezzo massimo è opzionale:

Lautaro Martinez = 900
Dimarco: 650
Nico Paz
Svilar`

export function ImportTargets() {
  const { state, dispatch } = useStore()
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [results, setResults] = useState<MatchResult[] | null>(null)
  /** Scelta per riga: indice nella lista dei candidati, oppure -1 per "ignora" */
  const [choice, setChoice] = useState<number[]>([])
  const [done, setDone] = useState<string | null>(null)

  function analyze() {
    const res = matchLines(text, state.players)
    setResults(res)
    setChoice(res.map((r) => (r.status === 'ok' ? 0 : -1)))
    setDone(null)
  }

  function confirm() {
    if (!results) return
    const items = results
      .map((r, i) => ({ r, pl: choice[i] >= 0 ? r.candidates[choice[i]] : null }))
      .filter((x) => x.pl)
      .map((x) => ({ playerId: x.pl!.id, maxPrice: x.r.maxPrice }))
    if (items.length > 0) dispatch({ type: 'addTargets', items })
    setDone(`${items.length} obiettivi aggiunti`)
    setResults(null)
    setText('')
  }

  const selectedCount = results ? choice.filter((c) => c >= 0).length : 0
  const notFound = results?.filter((r) => r.status === 'notfound') ?? []

  if (!open) {
    return (
      <div className="import-toggle">
        <button className="btn ghost small-btn" onClick={() => setOpen(true)}>
          ⬍ Importa obiettivi da lista
        </button>
        {done && <span className="ok small"> {done}</span>}
      </div>
    )
  }

  return (
    <div className="import-box">
      <div className="split-head">
        <b>Importa obiettivi da lista</b>
        <button
          className="btn ghost small-btn"
          onClick={() => {
            setOpen(false)
            setResults(null)
          }}
        >
          ✕ chiudi
        </button>
      </div>

      {!results ? (
        <>
          <textarea
            className="import-text"
            rows={7}
            placeholder={PLACEHOLDER}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <div className="dialog-actions">
            <button className="btn primary" disabled={text.trim().length === 0} onClick={analyze}>
              Analizza
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="muted small">
            {results.length} righe · {selectedCount} da aggiungere
            {notFound.length > 0 && ` · ${notFound.length} non riconosciute`}
          </p>
          <ul className="import-results">
            {results.map((r, i) => (
              <li key={`${r.raw}-${i}`} className={r.status}>
                <span className="import-raw small" title={r.raw}>
                  {r.raw}
                </span>
                {r.status === 'notfound' ? (
                  <span className="error small">non trovato</span>
                ) : (
                  <select
                    value={choice[i]}
                    onChange={(e) => {
                      const next = [...choice]
                      next[i] = Number(e.target.value)
                      setChoice(next)
                    }}
                  >
                    <option value={-1}>— ignora —</option>
                    {r.candidates.map((p, ci) => (
                      <option key={p.id} value={ci}>
                        {p.name} ({p.team}, {state.config.mode === 'mantra' ? p.rm.join(';') : p.r})
                      </option>
                    ))}
                  </select>
                )}
                <span className="import-price small muted">{r.maxPrice != null ? `max ${r.maxPrice}` : ''}</span>
              </li>
            ))}
          </ul>
          <div className="dialog-actions">
            <button className="btn ghost" onClick={() => setResults(null)}>
              ← Modifica lista
            </button>
            <button className="btn primary" disabled={selectedCount === 0} onClick={confirm}>
              Aggiungi {selectedCount} obiettivi
            </button>
          </div>
        </>
      )}
    </div>
  )
}
