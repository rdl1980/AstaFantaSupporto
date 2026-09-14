import { useEffect, useMemo, useRef, useState } from 'react'
import { liveDisponibile, oraServer, sincronizzaOrologio } from './client'
import { conteggio, etichetta } from './countdown'
import { useEsitoRecente } from './esito'
import { repartiLive, slotRuoloPieno, statoSquadra } from './derive'
import { aggiudicaSeScaduta, rilancia, rivendicaSquadra, trovaSessione, useLive } from './session'
import type { CredenzialiPartecipante, EsitoRilancio, SessioneRow } from './types'
import { MOTIVO_LEGGIBILE } from './types'
import { sbloccaAudio, suonaAggiudicato, suonaConteggio, suonaSuperato } from './suono'

const CHIAVE = 'asta-fanta-partecipante-v1'
const CHIAVE_AUDIO = 'asta-fanta-audio-v1'

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
  const [versioneSbloccata, setVersioneSbloccata] = useState<number | null>(null)
  const [audio, setAudio] = useState(() => {
    try {
      return localStorage.getItem(CHIAVE_AUDIO) !== 'off'
    } catch {
      return true
    }
  })
  const [vista, setVista] = useState<'asta' | 'rosa' | 'tabellone'>('asta')

  const chiamata = live.chiamata
  const attiva = chiamata?.stato === 'active' && !!chiamata.scadenza
  const sospesa = sessione.stato === 'paused'
  // Chiamata congelata a meta' conteggio: il server ha messo via quanto mancava
  // e ha tolto la scadenza, perche' un istante assoluto durante la pausa
  // scorrerebbe via da solo.
  const congelato = chiamata?.stato === 'paused' && chiamata.rimanenza_ms != null
  const esitoChiamata = useEsitoRecente(live.chiamata)
  useTick(attiva)

  const mia = useMemo(
    () => statoSquadra(sessione, live.assegnazioni, cred.squadraId),
    [sessione, live.assegnazioni, cred.squadraId],
  )
  const nomeSquadra = live.squadre.find((s) => s.id === cred.squadraId)?.nome ?? 'La mia squadra'
  const sonoIlMigliore = chiamata?.miglior_offerente_id === cred.squadraId
  const nomeMigliore = live.squadre.find((s) => s.id === chiamata?.miglior_offerente_id)?.nome

  const tempi = {
    attesaSecondi: sessione.attesa_secondi,
    secondiDa1A2: sessione.secondi_1_2,
    secondiDa2A3: sessione.secondi_2_3,
  }
  const c = attiva ? conteggio(new Date(chiamata!.scadenza!).getTime(), oraServer(), tempi) : null
  // Con scadenza a zero e ora a zero, `rimanenti` e' esattamente il tempo messo
  // da parte: la fase congelata si legge con la stessa funzione di sempre.
  const cFermo = congelato ? conteggio(chiamata!.rimanenza_ms!, 0, tempi) : null

  // Quando il conteggio finisce, il primo dispositivo che se ne accorge chiude la
  // chiamata. Serve perche' altrimenti l'aggiudicazione dipenderebbe dal browser
  // del banditore: se dorme, l'asta resta appesa su "AGGIUDICATO".
  useEffect(() => {
    if (!attiva || c?.fase !== 'scaduta') return
    const t = setTimeout(() => {
      void aggiudicaSeScaduta(cred.sessioneId).catch(() => {})
    }, 400)
    return () => clearTimeout(t)
  }, [attiva, c?.fase, cred.sessioneId])

  // Ogni movimento della chiamata blocca i pulsanti per un attimo.
  //
  // Nell'asta del 2026 era il difetto piu' odiato: la cifra si aggiornava
  // nell'istante fra lo sguardo e il dito, e "+1" partiva su una base diversa da
  // quella letta. Il blocco da' il tempo di accorgersi che il numero si e'
  // mosso; il controllo di versione lato server chiude il caso per le offerte
  // che scivolano comunque dentro la finestra.
  //
  // Il blocco e' espresso come "la versione a schermo non e' ancora sbloccata",
  // non come un istante da confrontare con l'orologio: cosi' si ricava durante
  // il render, senza leggere l'ora in un punto che React puo' rieseguire.
  const attesaOfferta = sessione.attesa_offerta_ms ?? 800
  const versioneCorrente = chiamata?.versione ?? null
  const bloccato = attesaOfferta > 0 && versioneCorrente != null && versioneCorrente !== versioneSbloccata

  useEffect(() => {
    if (!bloccato || versioneCorrente == null) return
    const t = setTimeout(() => setVersioneSbloccata(versioneCorrente), attesaOfferta)
    return () => clearTimeout(t)
  }, [bloccato, versioneCorrente, attesaOfferta])

  // Gli scalini non possono scendere sotto il rilancio minimo, altrimenti il
  // pulsante manderebbe un'offerta che il server rifiuta di sicuro.
  const scalini = useMemo(() => {
    const base = sessione.rilanci_rapidi?.length ? sessione.rilanci_rapidi : [1, 5, 10]
    const minimo = Math.max(1, sessione.rilancio_minimo)
    return [...new Set(base.map((n) => Math.max(minimo, Math.round(n))))].sort((a, b) => a - b)
  }, [sessione.rilanci_rapidi, sessione.rilancio_minimo])

  // --- tono del conteggio ---------------------------------------------------
  //
  // Si suona sui *passaggi* di fase, non a ogni render: la schermata si ridisegna
  // cinque volte al secondo, e senza questo il telefono farebbe un ronzio.
  const faseSonora = attiva && c ? (c.fase === 'conteggio' ? `n${c.numero}` : c.fase) : null
  const faseSuonata = useRef<string | null>(null)
  useEffect(() => {
    const prima = faseSuonata.current
    faseSuonata.current = faseSonora
    // Al primo giro non si suona nulla: chi apre la pagina a meta' conteggio
    // non deve sentire un bip a freddo.
    if (!audio || prima === null || faseSonora === prima) return
    if (faseSonora === 'n1') suonaConteggio(1)
    else if (faseSonora === 'n2') suonaConteggio(2)
    else if (faseSonora === 'scaduta') suonaConteggio(3)
  }, [faseSonora, audio])

  useEffect(() => {
    if (audio && esitoChiamata) suonaAggiudicato()
  }, [audio, esitoChiamata])

  // Essere superati e' la cosa che conviene sentire anche guardando altrove: e'
  // il motivo per cui il suono esiste.
  const eroIlMigliore = useRef(false)
  useEffect(() => {
    const adesso = chiamata?.miglior_offerente_id === cred.squadraId
    if (audio && eroIlMigliore.current && !adesso && chiamata?.stato === 'active') suonaSuperato()
    eroIlMigliore.current = adesso
  }, [audio, chiamata?.miglior_offerente_id, chiamata?.stato, cred.squadraId])

  async function cambiaAudio() {
    const acceso = !audio
    // Sbloccare deve avvenire *dentro* il tocco, altrimenti il browser rifiuta
    if (acceso) await sbloccaAudio()
    setAudio(acceso)
    try {
      localStorage.setItem(CHIAVE_AUDIO, acceso ? 'on' : 'off')
    } catch {
      // Archivio negato: la preferenza vale per questa sessione e basta
    }
  }

  const prossima = (chiamata?.offerta_attuale ?? 0) + sessione.rilancio_minimo
  const ruoloPieno = chiamata?.ruolo_classic
    ? slotRuoloPieno(sessione, live.assegnazioni, cred.squadraId, chiamata.ruolo_classic)
    : false
  const posso = attiva && !sonoIlMigliore && !ruoloPieno && prossima <= mia.maxOfferta && c?.fase !== 'scaduta'

  /**
   * @param versioneAttesa versione su cui l'offerta e' stata calcolata. La
   *   passano i pulsanti rapidi, che valgono solo sulla base letta; l'offerta
   *   libera no, perche' una cifra digitata resta quella che si voleva.
   */
  async function invia(offerta: number, versioneAttesa?: number | null) {
    if (inviando) return
    setInviando(true)
    setEsito(null)
    try {
      const r = await rilancia({
        sessioneId: cred.sessioneId,
        squadraId: cred.squadraId,
        claimToken: cred.claimToken,
        offerta,
        versioneAttesa,
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

  if (vista === 'tabellone') {
    return <Tabellone live={live} sessione={sessione} onIndietro={() => setVista('asta')} />
  }
  if (vista === 'rosa') {
    return (
      <MiaRosa
        live={live}
        sessione={sessione}
        squadraId={cred.squadraId}
        nomeSquadra={nomeSquadra}
        onIndietro={() => setVista('asta')}
      />
    )
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
        <div className="pt-viste">
          <button
            className="btn ghost small-btn pt-audio"
            onClick={() => void cambiaAudio()}
            title={audio ? 'Tono del conteggio acceso' : 'Tono del conteggio spento'}
            aria-label={audio ? 'Spegni il tono del conteggio' : 'Accendi il tono del conteggio'}
          >
            {audio ? '🔊' : '🔇'}
          </button>
          <button className="btn ghost small-btn" onClick={() => setVista('rosa')}>
            La mia rosa
          </button>
          <button className="btn ghost small-btn" onClick={() => setVista('tabellone')}>
            Tabellone
          </button>
        </div>
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

      {sospesa && (
        <div className="pt-sospesa">
          ⏸ ASTA SOSPESA
          <span className="small">Il banditore ha messo in pausa</span>
        </div>
      )}

      {congelato ? (
        <div className="pt-chiamata pt-congelato">
          <div className="pt-giocatore">{chiamata!.giocatore_nome}</div>
          <div className="muted">
            {chiamata!.club} · {chiamata!.ruoli_mantra || chiamata!.ruolo_classic}
          </div>
          <div className="pt-conteggio fase-fermo">{cFermo ? etichetta(cFermo) : ''}</div>
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
          <p className="muted small pt-msg">Il conteggio riparte da qui quando il banditore riprende.</p>
        </div>
      ) : !attiva && esitoChiamata ? (
        <div className="pt-chiamata pt-esito">
          <div className="pt-giocatore">{esitoChiamata.giocatore}</div>
          <div className="pt-conteggio fase-scaduta">
            TRE
            <div className="pt-aggiudicato">AGGIUDICATO</div>
          </div>
          <div className="pt-offerta">
            <b className="pt-num-grande">{esitoChiamata.prezzo}</b>
            <span className="muted">
              a {live.squadre.find((s) => s.id === esitoChiamata.squadraId)?.nome ?? '?'}
            </span>
          </div>
        </div>
      ) : !attiva ? (
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
              {/* Al "tre" si sa che il conteggio locale e' finito, non chi ha
                  vinto: un rilancio dell'ultimo istante puo' aver gia' allungato
                  la scadenza sul server. Prima qui compariva "AGGIUDICATO" e
                  l'aggiudicazione veniva poi smentita. Il verdetto arriva quando
                  il server chiude davvero la chiamata, via `esitoChiamata`. */}
              {c?.fase === 'scaduta' && chiamata?.miglior_offerente_id && (
                <div className="pt-chiusura">chiusura…</div>
              )}
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
            <div className="pt-rapidi">
              {scalini.map((step) => {
                const cifra = (chiamata!.offerta_attuale ?? 0) + step
                return (
                  <button
                    key={step}
                    className="pt-piu"
                    disabled={!posso || inviando || bloccato || cifra > mia.maxOfferta}
                    onClick={() => void invia(cifra, chiamata!.versione)}
                  >
                    <span className="pt-piu-step">+{step}</span>
                    <b className="pt-piu-cifra">{cifra}</b>
                  </button>
                )
              })}
            </div>
            {bloccato && posso && (
              <p className="muted small pt-msg pt-blocco">Il prezzo è appena cambiato…</p>
            )}
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

// ------------------------------------------------------------ la mia rosa ---

/**
 * Quello che serve sapere di sé mentre l'asta va avanti: chi si è preso, quanto
 * manca per reparto e come stanno i crediti. Sono le stesse quantità della
 * schermata principale, ma qui c'è lo spazio per elencarle.
 */
function MiaRosa({
  live,
  sessione,
  squadraId,
  nomeSquadra,
  onIndietro,
}: {
  live: ReturnType<typeof useLive>
  sessione: SessioneRow
  squadraId: string
  nomeSquadra: string
  onIndietro: () => void
}) {
  const stato = statoSquadra(sessione, live.assegnazioni, squadraId)
  const reparti = repartiLive(sessione, live.assegnazioni, squadraId)
  const mie = live.assegnazioni
    .filter((a) => a.squadra_id === squadraId)
    .sort((a, b) => b.prezzo - a.prezzo)

  return (
    <div className="pt">
      <header className="pt-head">
        <button className="btn ghost small-btn" onClick={onIndietro}>
          ← Indietro
        </button>
        <div className="pt-titolo">{nomeSquadra}</div>
      </header>

      <div className="pt-crediti">
        <div>
          <span className="muted small">Spesi</span>
          <b className="pt-num">{stato.spesi}</b>
        </div>
        <div>
          <span className="muted small">Residui</span>
          <b className="pt-num">{stato.residui}</b>
        </div>
        <div>
          <span className="muted small">Offerta max</span>
          <b className="pt-num">{stato.maxOfferta}</b>
        </div>
      </div>

      <div className="pt-corpo">
        {reparti.map((r) => {
          const giocatori = mie.filter((a) =>
            r.chiave === 'MOV' ? a.ruolo_classic !== 'P' : a.ruolo_classic === r.chiave,
          )
          return (
            <div className="pt-squadra-box" key={r.chiave}>
              <div className="pt-squadra-head">
                <b>
                  <span className={`badge role-${r.chiave === 'MOV' ? 'D' : r.chiave}`}>
                    {r.chiave === 'MOV' ? 'MOV' : r.chiave}
                  </span>{' '}
                  {r.label}
                </b>
                <span className="small">
                  <b>
                    {r.presi}/{r.totali}
                  </b>{' '}
                  {r.mancanti > 0 ? (
                    <span className="warn">ne mancano {r.mancanti}</span>
                  ) : (
                    <span className="ok">completo</span>
                  )}
                </span>
              </div>
              {giocatori.length === 0 ? (
                <div className="muted small">nessun acquisto</div>
              ) : (
                <ul className="pt-rosa">
                  {giocatori.map((a) => (
                    <li key={a.id}>
                      <span className={`badge role-${sessione.modalita === 'mantra' ? a.ruolo_classic : a.ruolo_classic}`}>
                        {sessione.modalita === 'mantra' ? (a.ruoli_mantra ?? a.ruolo_classic) : a.ruolo_classic}
                      </span>
                      <span className="pt-rosa-nome">
                        {a.giocatore_nome} <span className="muted small">{a.club}</span>
                      </span>
                      <b>{a.prezzo}</b>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )
        })}

        <p className="muted small pt-msg">
          {stato.presi}/{stato.slotTotali} giocatori · {stato.slotRimasti} slot ancora da riempire
        </p>
      </div>
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
