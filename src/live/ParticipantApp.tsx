import { useEffect, useMemo, useState } from 'react'
import { liveDisponibile, oraServer, sincronizzaOrologio } from './client'
import { conteggio, etichetta } from './countdown'
import { slotRuoloPieno, statoSquadra } from './derive'
import { rilancia, rivendicaSquadra, trovaSessione, useLive } from './session'
import type { CredenzialiPartecipante, EsitoRilancio, SessioneRow } from './types'
import { MOTIVO_LEGGIBILE } from './types'

const CHIAVE = 'asta-fanta-partecipante-v1'

function leggiCredenziali(codice: string): CredenzialiPartecipante | null {
  try {
    const raw = localStorage.getItem(`${CHIAVE}:${codice}`)
    return raw ? (JSON.parse(raw) as CredenzialiPartecipante) : null
  } catch {
    return null
  }
}

function salvaCredenziali(c: CredenzialiPartecipante) {
  try {
    localStorage.setItem(`${CHIAVE}:${c.codice}`, JSON.stringify(c))
  } catch {
    // storage non disponibile: si resta collegati solo per questa sessione
  }
}

/** Ridisegna finché c'è una chiamata attiva, per far scorrere il conteggio. */
function useTick(attivo: boolean) {
  const [, setN] = useState(0)
  useEffect(() => {
    if (!attivo) return
    const id = setInterval(() => setN((n) => n + 1), 200)
    return () => clearInterval(id)
  }, [attivo])
}

export function ParticipantApp({ codice }: { codice: string }) {
  const [sessione, setSessione] = useState<SessioneRow | null>(null)
  const [cred, setCred] = useState<CredenzialiPartecipante | null>(() => leggiCredenziali(codice))
  const [erroreAvvio, setErroreAvvio] = useState<string | null>(null)
  const [cercando, setCercando] = useState(true)

  useEffect(() => {
    if (!liveDisponibile) {
      // Effetto legittimo: interroga il server e riflette l'esito nello stato
      /* eslint-disable-next-line react/set-state-in-effect */
      setErroreAvvio('Questa copia dell’app non è collegata a nessun server.')
      /* eslint-disable-next-line react/set-state-in-effect */
      setCercando(false)
      return
    }
    trovaSessione(codice)
      .then((s) => {
        if (!s) setErroreAvvio(`Nessuna asta con il codice ${codice}.`)
        setSessione(s)
      })
      .catch((e) => setErroreAvvio(String(e.message ?? e)))
      .finally(() => setCercando(false))
    void sincronizzaOrologio()
  }, [codice])

  if (cercando) return <div className="pt-centro muted">Collegamento…</div>
  if (erroreAvvio) return <div className="pt-centro error">{erroreAvvio}</div>
  if (!sessione) return <div className="pt-centro error">Asta non trovata.</div>

  if (!cred) {
    return (
      <ScegliSquadra
        sessione={sessione}
        onScelta={(c) => {
          salvaCredenziali(c)
          setCred(c)
        }}
      />
    )
  }
  return <Terminale sessione={sessione} cred={cred} onEsci={() => setCred(null)} />
}

// ------------------------------------------------------ scelta della squadra --

function ScegliSquadra({
  sessione,
  onScelta,
}: {
  sessione: SessioneRow
  onScelta: (c: CredenzialiPartecipante) => void
}) {
  const live = useLive(sessione.id)
  const [errore, setErrore] = useState<string | null>(null)
  const [inCorso, setInCorso] = useState<string | null>(null)

  async function scegli(squadraId: string) {
    setErrore(null)
    setInCorso(squadraId)
    try {
      const token = await rivendicaSquadra(squadraId)
      onScelta({ codice: sessione.codice, sessioneId: sessione.id, squadraId, claimToken: token })
    } catch (e) {
      setErrore(
        String((e as Error).message) === 'squadra_gia_presa'
          ? 'Questa squadra è già stata presa da un altro dispositivo.'
          : String((e as Error).message),
      )
      live.ricarica()
    } finally {
      setInCorso(null)
    }
  }

  return (
    <div className="pt">
      <header className="pt-head">
        <div className="pt-titolo">{sessione.nome}</div>
        <div className="muted small">Codice {sessione.codice}</div>
      </header>
      <div className="pt-corpo">
        <p className="muted">Scegli la tua squadra. La scelta è definitiva.</p>
        {live.squadre.map((s) => (
          <button
            key={s.id}
            className="pt-squadra"
            disabled={s.presa || inCorso === s.id}
            onClick={() => void scegli(s.id)}
          >
            <span>{s.nome}</span>
            {s.presa ? <span className="muted small">già presa</span> : <span className="ok small">libera</span>}
          </button>
        ))}
        {errore && <p className="error">{errore}</p>}
      </div>
    </div>
  )
}

// ------------------------------------------------------------- terminale ----

function Terminale({
  sessione: sessioneIniziale,
  cred,
  onEsci,
}: {
  sessione: SessioneRow
  cred: CredenzialiPartecipante
  onEsci: () => void
}) {
  const live = useLive(cred.sessioneId)
  const sessione = live.sessione ?? sessioneIniziale
  const [esito, setEsito] = useState<EsitoRilancio | null>(null)
  const [offertaLibera, setOffertaLibera] = useState('')
  const [inviando, setInviando] = useState(false)
  const [vediTabellone, setVediTabellone] = useState(false)

  const chiamata = live.chiamata
  const attiva = chiamata?.stato === 'active' && !!chiamata.scadenza
  useTick(attiva)

  const mia = useMemo(
    () => statoSquadra(sessione, live.assegnazioni, cred.squadraId),
    [sessione, live.assegnazioni, cred.squadraId],
  )
  const nomeSquadra = live.squadre.find((s) => s.id === cred.squadraId)?.nome ?? 'La mia squadra'
  const sonoIlMigliore = chiamata?.miglior_offerente_id === cred.squadraId
  const nomeMigliore = live.squadre.find((s) => s.id === chiamata?.miglior_offerente_id)?.nome

  const c = attiva
    ? conteggio(new Date(chiamata!.scadenza!).getTime(), oraServer(), {
        attesaSecondi: sessione.attesa_secondi,
        intervalloSecondi: sessione.intervallo_secondi,
      })
    : null

  const prossima = (chiamata?.offerta_attuale ?? 0) + sessione.rilancio_minimo
  const ruoloPieno = chiamata?.ruolo_classic
    ? slotRuoloPieno(sessione, live.assegnazioni, cred.squadraId, chiamata.ruolo_classic)
    : false
  const posso = attiva && !sonoIlMigliore && !ruoloPieno && prossima <= mia.maxOfferta && c?.fase !== 'scaduta'

  async function invia(offerta: number) {
    if (inviando) return
    setInviando(true)
    setEsito(null)
    try {
      const r = await rilancia({
        sessioneId: cred.sessioneId,
        squadraId: cred.squadraId,
        claimToken: cred.claimToken,
        offerta,
      })
      setEsito(r)
      if (r.ok) setOffertaLibera('')
    } catch (e) {
      setEsito({ ok: false, motivo: 'nessuna_chiamata' } as EsitoRilancio)
      console.error(e)
    } finally {
      setInviando(false)
    }
  }

  if (vediTabellone) {
    return <Tabellone live={live} sessione={sessione} onIndietro={() => setVediTabellone(false)} />
  }

  return (
    <div className="pt">
      <header className="pt-head">
        <div>
          <div className="pt-titolo">{nomeSquadra}</div>
          <div className="muted small">
            {sessione.nome} · {live.connesso ? <span className="ok">in linea</span> : <span className="warn">fuori linea</span>}
          </div>
        </div>
        <button className="btn ghost small-btn" onClick={() => setVediTabellone(true)}>
          Tabellone
        </button>
      </header>

      <div className="pt-crediti">
        <div>
          <span className="muted small">Crediti</span>
          <b className="pt-num">{mia.residui}</b>
        </div>
        <div>
          <span className="muted small">Puoi offrire fino a</span>
          <b className="pt-num">{mia.maxOfferta}</b>
        </div>
        <div>
          <span className="muted small">Rosa</span>
          <b>
            {mia.presi}/{mia.slotTotali}
          </b>
        </div>
      </div>

      {!attiva ? (
        <div className="pt-attesa muted">
          <p>Nessun giocatore in asta.</p>
          <p className="small">Appena il banditore ne chiama uno lo vedrai qui.</p>
        </div>
      ) : (
        <>
          <div className="pt-chiamata">
            <div className="pt-giocatore">{chiamata!.giocatore_nome}</div>
            <div className="muted">
              {chiamata!.club} · {chiamata!.ruoli_mantra || chiamata!.ruolo_classic}
            </div>
            <div className={`pt-conteggio fase-${c?.fase} ${c?.fase === 'conteggio' ? 'num-' + c.numero : ''}`}>
              {c ? etichetta(c) : ''}
            </div>
            <div className="pt-offerta">
              <span className="muted small">Offerta attuale</span>
              <b className="pt-num-grande">{chiamata!.offerta_attuale ?? '—'}</b>
              <span className={sonoIlMigliore ? 'ok' : 'muted'}>
                {chiamata!.offerta_attuale == null
                  ? 'nessuna offerta'
                  : sonoIlMigliore
                    ? '★ sei tu il migliore'
                    : nomeMigliore}
              </span>
            </div>
          </div>

          <div className="pt-azioni">
            <button className="pt-piu" disabled={!posso || inviando} onClick={() => void invia(prossima)}>
              +{sessione.rilancio_minimo} → <b>{prossima}</b>
            </button>
            <div className="pt-libera">
              <input
                type="number"
                inputMode="numeric"
                min={prossima}
                placeholder="offerta"
                value={offertaLibera}
                onChange={(e) => setOffertaLibera(e.target.value)}
              />
              <button
                className="btn primary"
                disabled={!posso || inviando || !offertaLibera}
                onClick={() => void invia(Number(offertaLibera))}
              >
                Offri
              </button>
            </div>
          </div>

          {ruoloPieno && <p className="warn pt-msg">Hai già completato gli slot per questo ruolo.</p>}
          {!ruoloPieno && prossima > mia.maxOfferta && (
            <p className="warn pt-msg">Non puoi arrivare a {prossima}: il tuo massimo è {mia.maxOfferta}.</p>
          )}
          {esito && !esito.ok && (
            <p className="error pt-msg">
              {MOTIVO_LEGGIBILE[esito.motivo] ?? esito.motivo}
              {esito.motivo === 'crediti_insufficienti' && esito.massimo != null && ` (massimo ${esito.massimo})`}
            </p>
          )}
        </>
      )}

      <footer className="pt-piede">
        <button className="btn ghost small-btn" onClick={onEsci}>
          Cambia squadra su questo dispositivo
        </button>
      </footer>
    </div>
  )
}

// ------------------------------------------------------------- tabellone ----

function Tabellone({
  live,
  sessione,
  onIndietro,
}: {
  live: ReturnType<typeof useLive>
  sessione: SessioneRow
  onIndietro: () => void
}) {
  return (
    <div className="pt">
      <header className="pt-head">
        <button className="btn ghost small-btn" onClick={onIndietro}>
          ← Indietro
        </button>
        <div className="pt-titolo">Tabellone</div>
      </header>
      <div className="pt-corpo">
        {live.squadre.map((s) => {
          const st = statoSquadra(sessione, live.assegnazioni, s.id)
          const rosa = live.assegnazioni
            .filter((a) => a.squadra_id === s.id)
            .sort((a, b) => b.prezzo - a.prezzo)
          return (
            <div className="pt-squadra-box" key={s.id}>
              <div className="pt-squadra-head">
                <b>{s.nome}</b>
                <span className="muted small">
                  {st.presi}/{st.slotTotali} · {st.residui} crediti
                </span>
              </div>
              {rosa.length === 0 ? (
                <div className="muted small">nessun acquisto</div>
              ) : (
                <ul className="pt-rosa">
                  {rosa.map((a) => (
                    <li key={a.id}>
                      <span className={`badge role-${a.ruolo_classic}`}>{a.ruolo_classic}</span>
                      <span className="pt-rosa-nome">{a.giocatore_nome}</span>
                      <b>{a.prezzo}</b>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
