import { useEffect, useState } from 'react'
import { teamStats, useStore } from '../store'
import type { AppState, Player } from '../types'
import { AuctionPicker } from './AuctionsManager'
import { CallBar } from './CallBar'
import { LiveAdminPanel } from '../live/LiveAdminPanel'
import { Listone } from './Listone'
import { ModulesPanel } from './ModulesPanel'
import { MyRoster } from './MyRoster'
import { PrepPanel } from './PrepPanel'
import { PurchaseDialog } from './PurchaseDialog'
import { ScarcityPanel } from './ScarcityPanel'
import { TeamsPanel } from './TeamsPanel'

type Tab = 'rosa' | 'squadre' | 'obiettivi' | 'scarsita' | 'moduli'

export function AuctionScreen({
  onSetup,
  onReport,
}: {
  onSetup: () => void
  onReport: () => void
}) {
  const { state, dispatch, myTeamId, saveError } = useStore()
  const [tab, setTab] = useState<Tab>('rosa')
  const [dialogPlayer, setDialogPlayer] = useState<Player | null>(null)
  const [callPlayer, setCallPlayer] = useState<Player | null>(null)

  // In modalità chiamata il click sul listone mette il giocatore in trattativa
  // nella barra; altrove (rosa, squadre, obiettivi) apre sempre il dialog,
  // perché lì si va per correggere un acquisto, non per farne uno.
  const pickFromListone = (p: Player) =>
    state.config.callMode ? setCallPlayer(p) : setDialogPlayer(p)

  const myStats = teamStats(state, myTeamId)

  // Scorciatoia: / per cercare
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === '/' && (e.target as HTMLElement)?.tagName !== 'INPUT' && !dialogPlayer) {
        e.preventDefault()
        document.querySelector<HTMLInputElement>('.search')?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [dialogPlayer])

  function exportBackup() {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `asta-backup-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  function importBackup(file: File) {
    void file.text().then((txt) => {
      try {
        const parsed = JSON.parse(txt) as AppState
        if (!parsed?.config || !Array.isArray(parsed.players)) throw new Error('formato non valido')
        dispatch({ type: 'restoreState', state: parsed })
      } catch {
        alert('File di backup non valido')
      }
    })
  }

  return (
    <div className="auction">
      <header className="topbar">
        <div className="topbar-left">
          <AuctionPicker />
          <span className={`badge mode-badge ${state.config.mode}`}>
            {state.config.mode === 'mantra' ? 'MANTRA' : 'CLASSIC'}
          </span>
          <div className="stat">
            <span className="muted">Residuo</span> <b className="big-num">{myStats.remaining}</b>
            <span className="muted">/{state.config.budget}</span>
          </div>
          <div className="stat">
            <span className="muted">Offerta max</span> <b>{myStats.maxBid}</b>
          </div>
          <div className="stat">
            <span className="muted">Slot</span>{' '}
            <b>
              {myStats.count}/{myStats.count + myStats.slotsLeft}
            </b>
          </div>
        </div>
        <div className="topbar-right">
          <button
            className="btn ghost"
            onClick={() => dispatch({ type: 'undoLastPurchase' })}
            disabled={state.purchases.length === 0}
            title="Annulla l'ultimo acquisto registrato (di qualsiasi squadra)"
          >
            ↩ Annulla ultimo
          </button>
          <button className="btn ghost" onClick={exportBackup} title="Scarica backup JSON dello stato">
            ⬇ Backup
          </button>
          <label className="btn ghost" title="Ripristina da backup JSON">
            ⬆ Ripristina
            <input
              type="file"
              accept=".json"
              style={{ display: 'none' }}
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) importBackup(f)
                e.target.value = ''
              }}
            />
          </label>
          <button
            className={`btn ${state.config.callMode ? 'primary' : 'ghost'}`}
            onClick={() => {
              dispatch({ type: 'setConfig', patch: { callMode: !state.config.callMode } })
              setCallPlayer(null)
            }}
            title="Modalità chiamata: il click sul listone apre la barra di trattativa invece del dialog"
          >
            🔨 Chiamata
          </button>
          <button
            className="btn ghost"
            onClick={onReport}
            title="Report, export e cronologia dell'asta"
          >
            📊 Report
          </button>
          <button className="btn ghost" onClick={onSetup}>
            ⚙ Setup
          </button>
        </div>
      </header>

      {saveError && (
        <div className="save-error">
          ⚠ Salvataggio nel browser non riuscito (memoria piena). I dati sono solo in memoria: fai subito
          un <b>Backup</b> e libera spazio eliminando un&apos;asta vecchia.
        </div>
      )}

      <LiveAdminPanel inAsta={callPlayer} />

      {callPlayer && <CallBar player={callPlayer} onClose={() => setCallPlayer(null)} />}

      <div className="columns">
        <div className="col-listone">
          <Listone onPick={pickFromListone} />
        </div>
        <div className="col-side">
          <div className="tabs">
            <button className={tab === 'rosa' ? 'active' : ''} onClick={() => setTab('rosa')}>
              Rosa
            </button>
            <button className={tab === 'squadre' ? 'active' : ''} onClick={() => setTab('squadre')}>
              Squadre
            </button>
            <button className={tab === 'obiettivi' ? 'active' : ''} onClick={() => setTab('obiettivi')}>
              Obiettivi ★
            </button>
            <button className={tab === 'scarsita' ? 'active' : ''} onClick={() => setTab('scarsita')}>
              Scarsità
            </button>
            {state.config.mode === 'mantra' && (
              <button className={tab === 'moduli' ? 'active' : ''} onClick={() => setTab('moduli')}>
                Moduli
              </button>
            )}
          </div>
          <div className="tab-content">
            {tab === 'rosa' && <MyRoster onPick={setDialogPlayer} />}
            {tab === 'squadre' && <TeamsPanel onPick={setDialogPlayer} />}
            {tab === 'obiettivi' && <PrepPanel onPick={setDialogPlayer} />}
            {tab === 'scarsita' && <ScarcityPanel onPick={setDialogPlayer} />}
            {tab === 'moduli' && state.config.mode === 'mantra' && <ModulesPanel onPick={setDialogPlayer} />}
          </div>
        </div>
      </div>

      {dialogPlayer && <PurchaseDialog player={dialogPlayer} onClose={() => setDialogPlayer(null)} />}
    </div>
  )
}
