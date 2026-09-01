import { useRef, useState } from 'react'
import { matchLines, matchDrafts } from '../nameMatch'
import type { MatchResult } from '../nameMatch'
import { useStore } from '../store'
import { parseTargetsJson, serializeTargets } from '../targetsJson'
import { PRIORITY_LABEL, PRIORITY_ORDER } from '../types'

const PLACEHOLDER = `Un giocatore per riga, con prezzo massimo opzionale:

Lautaro Martinez = 900
Dimarco: 650
Nico Paz

Oppure incolla direttamente un JSON di obiettivi.`

export function ImportTargets() {
  const { state, dispatch, playersById } = useStore()
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [results, setResults] = useState<MatchResult[] | null>(null)
  /** Scelta per riga: indice nella lista dei candidati, oppure -1 per "ignora" */
  const [choice, setChoice] = useState<number[]>([])
  const [done, setDone] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  function analyze(source: string) {
    setError(null)
    const trimmed = source.trim()
    try {
      const res =
        trimmed.startsWith('{') || trimmed.startsWith('[')
          ? matchDrafts(parseTargetsJson(trimmed), state.players)
          : matchLines(trimmed, state.players)
      setResults(res)
      setChoice(res.map((r) => (r.status === 'ok' ? 0 : -1)))
      setDone(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Errore di lettura')
    }
  }

  function confirm() {
    if (!results) return
    const items = results
      .map((r, i) => ({ r, pl: choice[i] >= 0 ? r.candidates[choice[i]] : null }))
      .filter((x) => x.pl)
      .map((x) => ({
        playerId: x.pl!.id,
        maxPrice: x.r.draft.maxPrice,
        priority: x.r.draft.priority,
        note: x.r.draft.note,
      }))
    if (items.length > 0) dispatch({ type: 'addTargets', items })
    setDone(`${items.length} obiettivi aggiunti`)
    setResults(null)
    setText('')
  }

  function exportJson() {
    const blob = new Blob([serializeTargets(state, playersById)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `obiettivi-${state.config.mode}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const selectedCount = results ? choice.filter((c) => c >= 0).length : 0
  const notFound = results?.filter((r) => r.status === 'notfound') ?? []
  const targetCount = Object.keys(state.targets).length

  if (!open) {
    return (
      <div className="import-toggle">
        <button className="btn ghost small-btn" onClick={() => setOpen(true)}>
          ⬍ Importa obiettivi
        </button>
        {targetCount > 0 && (
          <button className="btn ghost small-btn" onClick={exportJson} title="Scarica gli obiettivi in JSON">
            ⬇ Esporta JSON
          </button>
        )}
        {done && <span className="ok small"> {done}</span>}
      </div>
    )
  }

  return (
    <div className="import-box">
      <div className="split-head">
        <b>Importa obiettivi</b>
        <button
          className="btn ghost small-btn"
          onClick={() => {
            setOpen(false)
            setResults(null)
            setError(null)
          }}
        >
          ✕ chiudi
        </button>
      </div>

      {!results ? (
        <>
          <p className="muted small">
            Incolla una lista di nomi oppure un file JSON di obiettivi (con priorità e prezzo massimo).
          </p>
          <textarea
            className="import-text"
            rows={7}
            placeholder={PLACEHOLDER}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          {error && <p className="error small">{error}</p>}
          <input
            ref={fileRef}
            type="file"
            accept=".json,.txt"
            style={{ display: 'none' }}
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) {
                void f.text().then((content) => {
                  setText(content)
                  analyze(content)
                })
              }
              e.target.value = ''
            }}
          />
          <div className="dialog-actions">
            <button className="btn ghost" onClick={() => fileRef.current?.click()}>
              📂 Carica file JSON
            </button>
            <button className="btn primary" disabled={text.trim().length === 0} onClick={() => analyze(text)}>
              Analizza
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="muted small">
            {results.length} voci · {selectedCount} da aggiungere
            {notFound.length > 0 && ` · ${notFound.length} non riconosciute`}
          </p>
          <ul className="import-results">
            {results.map((r, i) => (
              <li key={`${r.draft.label}-${i}`} className={r.status}>
                <span className="import-raw small" title={r.draft.label}>
                  {r.draft.label}
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
                <span className="import-meta small muted">
                  {r.draft.priority != null && PRIORITY_ORDER.includes(r.draft.priority)
                    ? PRIORITY_LABEL[r.draft.priority]
                    : ''}
                  {r.draft.maxPrice != null ? ` ${r.draft.maxPrice}` : ''}
                </span>
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
