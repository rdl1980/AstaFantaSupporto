import { useEffect, useMemo, useState } from 'react'
import { totalSlots, useStore } from '../store'
import type { Player } from '../types'
import { liveDisponibile, oraServer } from './client'
import { conteggio, durataTotale, etichetta } from './countdown'
import {
  aggiornaImpostazioni,
  annullaChiamata,
  assegna,
  creaSessione,
  mettiAllAsta,
  pubblicaAssegnazione,
  useLive,
} from './session'
import type { CredenzialiBanditore } from './types'

const CHIAVE = 'asta-fanta-banditore-v1'

function leggiCred(astaId: string): CredenzialiBanditore | null {
  try {
    const raw = localStorage.getItem(`${CHIAVE}:${astaId}`)
    return raw ? (JSON.parse(raw) as CredenzialiBanditore) : null
  } catch {
    return null
  }
}

function salvaCred(astaId: string, c: CredenzialiBanditore | null) {
  try {
    if (c) localStorage.setItem(`${CHIAVE}:${astaId}`, JSON.stringify(c))
    else localStorage.removeItem(`${CHIAVE}:${astaId}`)
  } catch {
    /* storage non disponibile */
  }
}

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
export function LiveAdminPanel({ inAsta }: { inAsta: Player | null }) {
  const { state, activeAuction, myTeamId } = useStore()
  const { config } = state
  const [cred, setCred] = useState<CredenzialiBanditore | null>(() => leggiCred(activeAuction.id))
  const [errore, setErrore] = useState<string | null>(null)
  const [inCorso, setInCorso] = useState(false)
  const [apri, setApri] = useState(false)

  // Cambiando asta locale cambiano anche le credenziali della sessione live:
  // e' l'aggiustamento di stato in render suggerito da React, non un effetto.
  const [astaVista, setAstaVista] = useState(activeAuction.id)
  if (astaVista !== activeAuction.id) {
    setAstaVista(activeAuction.id)
    setCred(leggiCred(activeAuction.id))
  }

  const live = useLive(cred?.sessioneId ?? null)
  const chiamata = live.chiamata
  const attiva = chiamata?.stato === 'active' && !!chiamata.scadenza
  useTick(attiva)

  const timer = {
    attesaSecondi: live.sessione?.attesa_secondi ?? config.attesaSecondi,
    intervalloSecondi: live.sessione?.intervallo_secondi ?? config.intervalloSecondi,
  }
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
        intervalloSecondi: config.intervalloSecondi,
      })
      const nuove = { codice: r.codice, sessioneId: r.sessioneId, adminToken: r.adminToken }
      salvaCred(activeAuction.id, nuove)
      setCred(nuove)
      setApri(true)
    } catch (e) {
      setErrore(String((e as Error).message ?? e))
    } finally {
      setInCorso(false)
    }
  }

  /** Squadra live corrispondente a una squadra locale, accoppiate per posizione. */
  function squadraLive(teamId: string): string | null {
    const i = config.teams.findIndex((t) => t.id === teamId)
    return live.squadre[i]?.id ?? null
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
      ) : (
        <button
          className="btn primary small-btn"
          disabled={!inAsta}
          title={inAsta ? `Metti all'asta ${inAsta.name}` : 'Scegli prima un giocatore dal listone'}
          onClick={() => inAsta && void chiama(inAsta)}
        >
          🔨 Metti all&apos;asta{inAsta ? ` ${inAsta.name}` : ''}
        </button>
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
            Durata di una chiamata senza rilanci: <b>{durataTotale(timer)}s</b> ({timer.attesaSecondi}s di
            attesa, poi {timer.intervalloSecondi}s per ogni numero). Si cambia dal Setup.
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
                  intervalloSecondi: config.intervalloSecondi,
                }).catch((e) => setErrore(String(e.message)))
              }
            >
              Applica i tempi del Setup alla sessione
            </button>
            <button
              className="btn ghost small-btn"
              title="Copia sul server tutti gli acquisti già registrati in locale"
              onClick={async () => {
                if (!live.sessione) return
                setInCorso(true)
                try {
                  for (const pu of state.purchases) {
                    const pl = state.players.find((x) => x.id === pu.playerId)
                    const sq = squadraLive(pu.teamId)
                    if (!pl || !sq) continue
                    await pubblicaAssegnazione({
                      sessioneId: cred.sessioneId,
                      adminToken: cred.adminToken,
                      squadraId: sq,
                      giocatoreId: pl.id,
                      nome: pl.name,
                      club: pl.team,
                      ruolo: pl.r,
                      ruoliMantra: pl.rm.join(';'),
                      prezzo: pu.price,
                    })
                  }
                } catch (e) {
                  setErrore(String((e as Error).message))
                } finally {
                  setInCorso(false)
                }
              }}
            >
              Allinea acquisti locali → server ({state.purchases.length})
            </button>
            <button
              className="btn ghost small-btn danger-text"
              onClick={() => {
                if (confirm('Scollegare questa asta dalla sessione live? I dati sul server restano.')) {
                  salvaCred(activeAuction.id, null)
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
