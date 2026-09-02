import { useRef, useState } from 'react'
import { AuctionsCard } from './AuctionsManager'
import { parseListone } from '../parseListone'
import { useStore } from '../store'
import type { ClassicRole, Mode } from '../types'
import { CLASSIC_ROLE_LABEL, CLASSIC_ROLE_ORDER } from '../types'
import { durataTotale } from '../live/countdown'

export function SetupScreen({ onDone }: { onDone: () => void }) {
  const { state, dispatch } = useStore()
  const { config } = state
  const fileRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [importMsg, setImportMsg] = useState<string | null>(null)

  async function handleFile(file: File) {
    setError(null)
    try {
      const buf = await file.arrayBuffer()
      const { players, cedutiCount } = parseListone(buf)
      const prevPurchases = state.purchases.length
      dispatch({ type: 'importPlayers', players, fileName: file.name })
      setImportMsg(
        `Importati ${players.length} giocatori utilizzabili · ${cedutiCount} nel foglio Ceduti (esclusi)` +
          (prevPurchases > 0 ? ' — acquisti e obiettivi esistenti mantenuti dove possibile' : ''),
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Errore durante la lettura del file')
    }
  }

  return (
    <div className="setup">
      <h1>⚽ Asta Fanta Supporto</h1>

      <AuctionsCard />

      <section className="card">
        <h2>Listone quotazioni</h2>
        <p className="muted">
          Importa il file Excel delle quotazioni scaricato da fantacalcio.it. Puoi reimportare il file
          definitivo poco prima dell&apos;asta: acquisti e obiettivi vengono mantenuti.
        </p>
        <input
          ref={fileRef}
          type="file"
          accept=".xlsx,.xls"
          style={{ display: 'none' }}
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) void handleFile(f)
            e.target.value = ''
          }}
        />
        <button className="btn primary" onClick={() => fileRef.current?.click()}>
          {state.players.length > 0 ? 'Reimporta listone' : 'Importa listone (.xlsx)'}
        </button>
        {state.listoneInfo && (
          <p className="muted">
            File attuale: <b>{state.listoneInfo.fileName}</b> ·{' '}
            {new Date(state.listoneInfo.importedAt).toLocaleString('it-IT')} · {state.players.length}{' '}
            giocatori
          </p>
        )}
        {importMsg && <p className="ok">{importMsg}</p>}
        {error && <p className="error">{error}</p>}
      </section>

      <section className="card">
        <h2>Regole della lega</h2>
        <div className="form-row">
          <label>
            Modalità
            <select
              value={config.mode}
              onChange={(e) => dispatch({ type: 'setConfig', patch: { mode: e.target.value as Mode } })}
            >
              <option value="mantra">Mantra</option>
              <option value="classic">Classic</option>
            </select>
          </label>
          <label>
            Budget per squadra
            <input
              type="number"
              min={1}
              value={config.budget}
              onChange={(e) => dispatch({ type: 'setConfig', patch: { budget: Number(e.target.value) || 0 } })}
            />
          </label>
          <label>
            Numero squadre
            <input
              type="number"
              min={2}
              max={20}
              value={config.teams.length}
              onChange={(e) => dispatch({ type: 'setTeamCount', count: Number(e.target.value) || 2 })}
            />
          </label>
        </div>

        {config.mode === 'mantra' ? (
          <div className="form-row">
            <label>
              Portieri
              <input
                type="number"
                min={1}
                value={config.mantraGk}
                onChange={(e) => dispatch({ type: 'setConfig', patch: { mantraGk: Number(e.target.value) || 0 } })}
              />
            </label>
            <label>
              Giocatori di movimento
              <input
                type="number"
                min={1}
                value={config.mantraOutfield}
                onChange={(e) =>
                  dispatch({ type: 'setConfig', patch: { mantraOutfield: Number(e.target.value) || 0 } })
                }
              />
            </label>
          </div>
        ) : (
          <div className="form-row">
            {CLASSIC_ROLE_ORDER.map((r: ClassicRole) => (
              <label key={r}>
                {CLASSIC_ROLE_LABEL[r]}
                <input
                  type="number"
                  min={0}
                  value={config.classicSlots[r]}
                  onChange={(e) =>
                    dispatch({
                      type: 'setConfig',
                      patch: { classicSlots: { ...config.classicSlots, [r]: Number(e.target.value) || 0 } },
                    })
                  }
                />
              </label>
            ))}
          </div>
        )}
      </section>

      <section className="card">
        <h2>Asta live</h2>
        <p className="muted">
          Tempi della chiamata quando l&apos;asta è sincronizzata con i telefoni dei partecipanti.
          Dopo ogni offerta riparte l&apos;attesa, poi il conteggio: uno, due, tre, aggiudicato.
        </p>
        <div className="form-row">
          <label>
            Rilancio minimo
            <input
              type="number"
              min={1}
              value={config.rilancioMinimo}
              onChange={(e) =>
                dispatch({ type: 'setConfig', patch: { rilancioMinimo: Math.max(1, Number(e.target.value) || 1) } })
              }
            />
          </label>
          <label>
            Attesa prima del conteggio (s)
            <input
              type="number"
              min={0}
              value={config.attesaSecondi}
              onChange={(e) =>
                dispatch({ type: 'setConfig', patch: { attesaSecondi: Math.max(0, Number(e.target.value) || 0) } })
              }
            />
          </label>
          <label>
            Secondi fra uno, due e tre
            <input
              type="number"
              min={1}
              value={config.intervalloSecondi}
              onChange={(e) =>
                dispatch({ type: 'setConfig', patch: { intervalloSecondi: Math.max(1, Number(e.target.value) || 1) } })
              }
            />
          </label>
        </div>
        <p className="muted small">
          Una chiamata senza rilanci dura{' '}
          <b>
            {durataTotale({
              attesaSecondi: config.attesaSecondi,
              intervalloSecondi: config.intervalloSecondi,
            })}
            s
          </b>
          .
        </p>
      </section>

      <section className="card">
        <h2>Squadre</h2>
        <p className="muted">La prima è la tua. Puoi rinominarle anche durante l&apos;asta.</p>
        <div className="teams-grid">
          {config.teams.map((t) => (
            <input
              key={t.id}
              className={t.isMine ? 'mine' : ''}
              value={t.name}
              onChange={(e) => dispatch({ type: 'renameTeam', teamId: t.id, name: e.target.value })}
            />
          ))}
        </div>
      </section>

      <div className="setup-actions">
        <button className="btn primary big" disabled={state.players.length === 0} onClick={onDone}>
          {state.players.length === 0 ? 'Importa il listone per iniziare' : "Vai all'asta →"}
        </button>
      </div>
    </div>
  )
}
