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
      <h1 className="titolo-app">
        {/* Lo stesso martello dell'icona nella scheda: una sola identità */}
        <svg viewBox="0 0 64 64" width="30" height="30" aria-hidden="true">
          <rect width="64" height="64" rx="14" fill="var(--bg2)" />
          <rect x="0.5" y="0.5" width="63" height="63" rx="13.5" fill="none" stroke="var(--border)" />
          <g transform="rotate(-32 32 30)">
            <rect x="16" y="18" width="32" height="13" rx="3.5" fill="var(--gold)" />
            <rect x="30" y="29" width="5" height="21" rx="2.5" fill="#c9962b" />
          </g>
          <rect x="17" y="50" width="30" height="5" rx="2.5" fill="var(--accent)" />
        </svg>
        Asta Fanta Supporto
      </h1>

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
            Partecipanti
            <input
              type="number"
              value={config.teams.length}
              readOnly
              disabled
              title="Il numero di partecipanti si fissa alla creazione dell'asta"
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
        <p className="muted small">
          Il numero di partecipanti è fissato alla creazione e non si cambia: le squadre esistono anche
          nella sessione live, e spostarne il conteggio a metà strada scombinerebbe rose e crediti. Per un
          numero diverso crea una nuova asta con <b>＋ Nuova asta</b>.
        </p>
      </section>

      <section className="card">
        <h2>Asta live</h2>
        <p className="muted">
          Tempi della chiamata quando l&apos;asta è sincronizzata con i telefoni dei partecipanti.
          Dopo ogni offerta riparte l&apos;attesa, poi il conteggio: uno, due, tre. Al tre è aggiudicato.
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
            Secondi da uno a due
            <input
              type="number"
              min={1}
              value={config.secondiDa1A2}
              onChange={(e) =>
                dispatch({ type: 'setConfig', patch: { secondiDa1A2: Math.max(1, Number(e.target.value) || 1) } })
              }
            />
          </label>
          <label>
            Secondi da due a tre
            <input
              type="number"
              min={1}
              value={config.secondiDa2A3}
              onChange={(e) =>
                dispatch({ type: 'setConfig', patch: { secondiDa2A3: Math.max(1, Number(e.target.value) || 1) } })
              }
            />
          </label>
        </div>
        <div className="form-row">
          <label>
            Rilanci rapidi
            <input
              type="text"
              inputMode="numeric"
              value={config.rilanciRapidi.join(', ')}
              placeholder="1, 5, 10"
              onChange={(e) => {
                // Si accetta qualunque separatore: mentre si digita "1, 5," la
                // lista e' incompleta di proposito, e rifiutarla bloccherebbe
                // la scrittura. Numeri validi ora, ordine e limiti al blur.
                const n = e.target.value
                  .split(/[^0-9]+/)
                  .filter(Boolean)
                  .map(Number)
                  .slice(0, 4)
                dispatch({ type: 'setConfig', patch: { rilanciRapidi: n } })
              }}
              onBlur={() =>
                dispatch({
                  type: 'setConfig',
                  patch: {
                    rilanciRapidi: config.rilanciRapidi.length
                      ? [...new Set(config.rilanciRapidi.filter((x) => x >= 1))].sort((a, b) => a - b)
                      : [1, 5, 10],
                  },
                })
              }
            />
          </label>
          <label>
            Blocco dopo un rilancio (ms)
            <input
              type="number"
              min={0}
              max={5000}
              step={100}
              value={config.attesaOffertaMs}
              onChange={(e) =>
                dispatch({
                  type: 'setConfig',
                  patch: { attesaOffertaMs: Math.min(5000, Math.max(0, Number(e.target.value) || 0)) },
                })
              }
            />
          </label>
        </div>
        <p className="muted small">
          I rilanci rapidi sono i pulsanti sul telefono: ogni scalino mostra anche la cifra a cui
          porta. Dopo ogni cambio di prezzo restano bloccati per il tempo indicato, cosi&apos; nessuno
          offre su una base che si e&apos; mossa fra lo sguardo e il dito. Un&apos;offerta partita
          comunque su una base vecchia viene rifiutata dal server, non corretta al rialzo.
        </p>
        <p className="muted small">
          Una chiamata senza rilanci dura{' '}
          <b>
            {durataTotale({
              attesaSecondi: config.attesaSecondi,
              secondiDa1A2: config.secondiDa1A2,
              secondiDa2A3: config.secondiDa2A3,
            })}
            s
          </b>
          : al &ldquo;tre&rdquo; le offerte si chiudono e il giocatore è aggiudicato. &ldquo;TRE&rdquo; e
          &ldquo;AGGIUDICATO&rdquo; restano insieme a schermo per 3 secondi.
        </p>
      </section>

      <section className="card">
        <h2>Asta a sorteggio</h2>
        <p className="muted">
          Invece di chiamare i giocatori a turno, li estrae l&apos;app: dalla schermata d&apos;asta il
          pulsante <b>🎲 Estrai</b> pesca il prossimo da mettere in trattativa.
        </p>
        <div className="form-row">
          <label>
            Da dove pescare
            <select
              value={config.sorteggioAmbito}
              onChange={(e) =>
                dispatch({
                  type: 'setConfig',
                  patch: { sorteggioAmbito: e.target.value as 'tutti' | 'ruolo' },
                })
              }
            >
              <option value="tutti">Lista completa</option>
              <option value="ruolo">Un reparto alla volta</option>
            </select>
          </label>
        </div>
        <p className="muted small">
          Con <b>un reparto alla volta</b>, accanto al pulsante compaiono P/D/C/A e si sceglie da quale
          pescare: è il modo in cui molte leghe fanno l&apos;asta, finendo i portieri prima di passare
          ai difensori. Anche in Mantra il reparto è quello Classic — i ruoli Mantra sono undici e un
          giocatore ne ha più d&apos;uno, quindi non dividono il listone in gruppi netti.
        </p>
        <p className="muted small">
          Chi esce e non viene assegnato resta fuori dal mazzo, così non si ripresenta subito. Quando
          il mazzo finisce si rimescola da capo con quelli avanzati.
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
