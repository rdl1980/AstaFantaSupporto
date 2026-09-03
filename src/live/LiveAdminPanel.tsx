import { useEffect, useMemo, useRef, useState } from 'react'
import { totalSlots, useStore } from '../store'
import type { Player } from '../types'
import { liveDisponibile, oraServer } from './client'
import { conteggio, durataTotale, etichetta } from './countdown'
import { useEsitoRecente } from './esito'
import {
  aggiornaImpostazioni,
  annullaChiamata,
  assegna,
  creaSessione,
  mettiAllAsta,
  useLive,
} from './session'
import { useSincronizzaAcquisti } from './sync'
import type { CredenzialiBanditore } from './types'

function useTick(attivo: boolean) {
  const [, setN] = useState(0)
  useEffect(() => {
    if (!attivo) return
    const id = setInterval(() => setN((n) => n + 1), 200)
    return () => clearInterval(id)
  }, [attivo])
}

/**
 * Comandi della sessione live per il banditore, dentro l'app che già usa.
 * Se la sessione non è avviata, o Supabase non è configurato, tutto il resto
 * dell'app continua a funzionare esattamente come prima.
 */
export function LiveAdminPanel({
  inAsta,
  cred,
  setCred,
}: {
  inAsta: Player | null
  cred: CredenzialiBanditore | null
  setCred: (c: CredenzialiBanditore | null) => void
}) {
  const { state, activeAuction, myTeamId } = useStore()
  const { config } = state
  const [errore, setErrore] = useState<string | null>(null)
  const [inCorso, setInCorso] = useState(false)
  const [apri, setApri] = useState(false)
  const [cerca, setCerca] = useState('')
  const cercaRef = useRef<HTMLInputElement>(null)

  const live = useLive(cred?.sessioneId ?? null)
  const { dispatch } = useStore()
  useSincronizzaAcquisti(activeAuction.id, cred, live, state, dispatch)
  const chiamata = live.chiamata
  const attiva = chiamata?.stato === 'active' && !!chiamata.scadenza
  useTick(attiva)

  const timer = {
    attesaSecondi: live.sessione?.attesa_secondi ?? config.attesaSecondi,
    secondiDa1A2: live.sessione?.secondi_1_2 ?? config.secondiDa1A2,
    secondiDa2A3: live.sessione?.secondi_2_3 ?? config.secondiDa2A3,
  }
  const esito = useEsitoRecente(live.chiamata)
  const c = attiva
    ? conteggio(new Date(chiamata!.scadenza!).getTime(), oraServer(), timer)
    : null

  // Il conteggio finito aggiudica da solo: è il gesto che il banditore farebbe
  // comunque, e toglie un click nel momento più concitato.
  useEffect(() => {
    if (!cred || !attiva || c?.fase !== 'scaduta' || !chiamata?.miglior_offerente_id) return
    void assegna(cred.sessioneId, cred.adminToken).catch(() => {})
  }, [cred, attiva, c?.fase, chiamata?.miglior_offerente_id])

  const nomeMigliore = live.squadre.find((s) => s.id === chiamata?.miglior_offerente_id)?.nome

  // Chi banditore sente il nome e lo digita: la ricerca sta qui, accanto al
  // pulsante, invece di obbligare a passare dal listone e da un secondo comando.
  const gia = useMemo(
    () => new Set(live.assegnazioni.map((a) => a.giocatore_id)),
    [live.assegnazioni],
  )
  const suggeriti = useMemo(() => {
    const q = cerca.trim().toLowerCase()
    if (q.length < 2) return []
    return state.players
      .filter((p) => !p.ceduto && !gia.has(p.id) && p.name.toLowerCase().includes(q))
      .slice(0, 6)
  }, [cerca, state.players, gia])

  const linkPartecipanti = useMemo(() => {
    if (!cred) return ''
    return `${window.location.origin}${window.location.pathname}?asta=${cred.codice}`
  }, [cred])

  if (!liveDisponibile) return null

  async function avvia() {
    setErrore(null)
    setInCorso(true)
    try {
      const slotConfig =
        config.mode === 'mantra'
          ? { portieri: config.mantraGk, movimento: config.mantraOutfield }
          : { slot: config.classicSlots }
      const r = await creaSessione({
        nome: activeAuction.name,
        modalita: config.mode,
        budget: config.budget,
        slotConfig,
        squadre: config.teams.map((t) => t.name),
        rilancioMinimo: config.rilancioMinimo,
        attesaSecondi: config.attesaSecondi,
        secondiDa1A2: config.secondiDa1A2,
        secondiDa2A3: config.secondiDa2A3,
      })
      setCred({ codice: r.codice, sessioneId: r.sessioneId, adminToken: r.adminToken })
      setApri(true)
    } catch (e) {
      setErrore(String((e as Error).message ?? e))
    } finally {
      setInCorso(false)
    }
  }

  async function chiama(p: Player) {
    if (!cred) return
    setErrore(null)
    try {
      const r = await mettiAllAsta({
        sessioneId: cred.sessioneId,
        adminToken: cred.adminToken,
        giocatoreId: p.id,
        nome: p.name,
        club: p.team,
        ruolo: p.r,
        ruoliMantra: p.rm.join(';'),
      })
      if (!r?.ok) setErrore(r?.motivo ?? 'chiamata non riuscita')
    } catch (e) {
      setErrore(String((e as Error).message ?? e))
    }
  }

  if (!cred) {
    return (
      <div className="live-bar">
        <span className="muted small">Asta live non avviata</span>
        <button className="btn ghost small-btn" disabled={inCorso} onClick={() => void avvia()}>
          📡 Avvia sessione live
        </button>
        {errore && <span className="error small">{errore}</span>}
      </div>
    )
  }

  return (
    <div className="live-bar">
      <span className={`badge ${live.connesso ? 'current-badge' : 'ceduto'}`}>
        {live.connesso ? 'LIVE' : 'OFFLINE'}
      </span>
      <span className="small">
        <span className="muted">codice</span> <b className="live-codice">{cred.codice}</b>
      </span>
      <button
        className="btn ghost small-btn"
        onClick={() => void navigator.clipboard?.writeText(linkPartecipanti)}
        title={linkPartecipanti}
      >
        📋 Copia link
      </button>
      <span className="muted small">
        {live.squadre.filter((s) => s.presa).length}/{live.squadre.length} collegati
      </span>

      {attiva ? (
        <>
          <span className="live-chiamata">
            <b>{chiamata!.giocatore_nome}</b>{' '}
            <span className="muted">{chiamata!.offerta_attuale ?? '—'}</span>{' '}
            {nomeMigliore && <span className="ok small">{nomeMigliore}</span>}
          </span>
          <span className={`live-conteggio fase-${c?.fase}`}>{c ? etichetta(c) : ''}</span>
          <button
            className="btn primary small-btn"
            disabled={!chiamata!.miglior_offerente_id}
            onClick={() => void assegna(cred.sessioneId, cred.adminToken)}
          >
            Aggiudica
          </button>
          <button
            className="btn ghost small-btn"
            onClick={() => void annullaChiamata(cred.sessioneId, cred.adminToken)}
          >
            Annulla
          </button>
        </>
      ) : esito ? (
        <span className="live-esito">
          🔨 <b>{esito.giocatore}</b> a{' '}
          <b>{live.squadre.find((s) => s.id === esito.squadraId)?.nome ?? '?'}</b> per{' '}
          <b>{esito.prezzo}</b>
        </span>
      ) : (
        <div className="live-chiama">
          <input
            ref={cercaRef}
            className="live-cerca"
            placeholder="Chi va all'asta? scrivi il nome…"
            value={cerca}
            onChange={(e) => setCerca(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && suggeriti[0]) {
                void chiama(suggeriti[0])
                setCerca('')
              }
              if (e.key === 'Escape') setCerca('')
            }}
          />
          {suggeriti.length > 0 && (
            <div className="live-suggeriti">
              {suggeriti.map((p) => (
                <button
                  key={p.id}
                  className="btn small-btn"
                  onClick={() => {
                    void chiama(p)
                    setCerca('')
                  }}
                >
                  {p.name} <span className="muted">{p.team}</span>
                </button>
              ))}
            </div>
          )}
          {inAsta && (
            <button className="btn primary small-btn" onClick={() => void chiama(inAsta)}>
              🔨 Metti all&apos;asta {inAsta.name}
            </button>
          )}
          {!inAsta && cerca.trim().length < 2 && (
            <span className="muted small">oppure clicca un giocatore nel listone</span>
          )}
        </div>
      )}

      <button className="btn ghost small-btn" onClick={() => setApri((v) => !v)}>
        {apri ? '▲' : '▼'}
      </button>

      {errore && <span className="error small">{errore}</span>}

      {apri && (
        <div className="live-dettagli">
          <p className="muted small">
            Link per i partecipanti: <code>{linkPartecipanti}</code>
          </p>
          <p className="muted small">
            Durata di una chiamata senza rilanci: <b>{durataTotale(timer)}s</b> — {timer.attesaSecondi}s di
            attesa, {timer.secondiDa1A2}s dall&apos;uno al due, {timer.secondiDa2A3}s dal due al tre e
            altrettanti prima dell&apos;aggiudicazione. Si cambia dal Setup.
          </p>
          <div className="live-azioni-extra">
            <button
              className="btn ghost small-btn"
              onClick={() =>
                void aggiornaImpostazioni({
                  sessioneId: cred.sessioneId,
                  adminToken: cred.adminToken,
                  rilancioMinimo: config.rilancioMinimo,
                  attesaSecondi: config.attesaSecondi,
                  secondiDa1A2: config.secondiDa1A2,
                  secondiDa2A3: config.secondiDa2A3,
                }).catch((e) => setErrore(String(e.message)))
              }
            >
              Applica i tempi del Setup alla sessione
            </button>
            <button
              className="btn ghost small-btn danger-text"
              onClick={() => {
                if (confirm('Scollegare questa asta dalla sessione live? I dati sul server restano.')) {
                  setCred(null)
                }
              }}
            >
              Scollega
            </button>
          </div>
          <p className="muted small">
            Slot per squadra: {totalSlots(config)} · la mia squadra:{' '}
            {config.teams.find((t) => t.id === myTeamId)?.name}
          </p>
        </div>
      )}
    </div>
  )
}
