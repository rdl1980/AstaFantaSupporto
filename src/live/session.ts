import { useCallback, useEffect, useRef, useState } from 'react'
import { sincronizzaOrologio, supabase } from './client'
import type {
  AssegnazioneRow,
  ChiamataRow,
  EsitoRilancio,
  SessioneRow,
  SquadraRow,
} from './types'

function client() {
  if (!supabase) throw new Error('Supabase non configurato')
  return supabase
}

// ------------------------------------------------------------ creazione ----

export async function creaSessione(args: {
  nome: string
  modalita: 'mantra' | 'classic'
  budget: number
  slotConfig: object
  squadre: string[]
  rilancioMinimo: number
  attesaSecondi: number
  secondiDa1A2: number
  secondiDa2A3: number
  rilanciRapidi: number[]
  attesaOffertaMs: number
  /**
   * Rose gia' costruite, per il mercato di riparazione. Ogni voce punta alla
   * squadra per `ordine`, perche' gli id delle squadre nascono solo qui dentro.
   */
  assegnazioni?: {
    ordine: number
    giocatore_id: number
    nome: string
    club: string
    ruolo: string
    ruoli_mantra: string | null
    prezzo: number
  }[]
  /** Scostamento dal budget, una voce per squadra nell'ordine di `squadre` */
  rettifiche?: number[]
}): Promise<{ sessioneId: string; codice: string; adminToken: string }> {
  const { data, error } = await client().rpc('crea_sessione', {
    p_nome: args.nome,
    p_modalita: args.modalita,
    p_budget: args.budget,
    p_slot_config: args.slotConfig,
    p_squadre: args.squadre,
    p_rilancio_minimo: args.rilancioMinimo,
    p_attesa_secondi: args.attesaSecondi,
    p_secondi_1_2: args.secondiDa1A2,
    p_secondi_2_3: args.secondiDa2A3,
    p_rilanci_rapidi: args.rilanciRapidi,
    p_attesa_offerta_ms: args.attesaOffertaMs,
    p_assegnazioni: args.assegnazioni ?? [],
    p_rettifiche: args.rettifiche ?? null,
  })
  if (error) throw new Error(error.message)
  if (!data?.ok) throw new Error(data?.motivo ?? 'creazione fallita')
  return { sessioneId: data.sessione_id, codice: data.codice, adminToken: data.admin_token }
}

export async function trovaSessione(codice: string): Promise<SessioneRow | null> {
  const { data, error } = await client()
    .from('sessione')
    .select('*')
    .eq('codice', codice.trim().toUpperCase())
    .maybeSingle()
  if (error) throw new Error(error.message)
  return (data as SessioneRow) ?? null
}

export async function rivendicaSquadra(squadraId: string): Promise<string> {
  const { data, error } = await client().rpc('rivendica_squadra', { p_squadra: squadraId })
  if (error) throw new Error(error.message)
  if (!data?.ok) throw new Error(data?.motivo ?? 'squadra già presa')
  return data.claim_token as string
}

// ------------------------------------------------------------- comandi -----

export async function pubblicaAssegnazione(args: {
  sessioneId: string
  adminToken: string
  squadraId: string
  giocatoreId: number
  nome: string
  club: string
  ruolo: string
  ruoliMantra: string | null
  prezzo: number
}) {
  const { data, error } = await client().rpc('pubblica_assegnazione', {
    p_sessione: args.sessioneId,
    p_admin_token: args.adminToken,
    p_squadra: args.squadraId,
    p_giocatore_id: args.giocatoreId,
    p_nome: args.nome,
    p_club: args.club,
    p_ruolo: args.ruolo,
    p_ruoli_mantra: args.ruoliMantra,
    p_prezzo: args.prezzo,
  })
  if (error) throw new Error(error.message)
  return data
}

export async function rimuoviAssegnazione(sessioneId: string, adminToken: string, giocatoreId: number) {
  const { error } = await client().rpc('rimuovi_assegnazione', {
    p_sessione: sessioneId,
    p_admin_token: adminToken,
    p_giocatore_id: giocatoreId,
  })
  if (error) throw new Error(error.message)
}

export async function mettiAllAsta(args: {
  sessioneId: string
  adminToken: string
  giocatoreId: number
  nome: string
  club: string
  ruolo: string
  ruoliMantra: string | null
  base?: number
}) {
  const { data, error } = await client().rpc('metti_all_asta', {
    p_sessione: args.sessioneId,
    p_admin_token: args.adminToken,
    p_giocatore_id: args.giocatoreId,
    p_nome: args.nome,
    p_club: args.club,
    p_ruolo: args.ruolo,
    p_ruoli_mantra: args.ruoliMantra,
    p_base: args.base ?? 0,
  })
  if (error) throw new Error(error.message)
  return data
}

export async function assegna(sessioneId: string, adminToken: string) {
  const { data, error } = await client().rpc('assegna', {
    p_sessione: sessioneId,
    p_admin_token: adminToken,
  })
  if (error) throw new Error(error.message)
  return data
}

/**
 * Chiude una chiamata scaduta. Non serve il token del banditore: chiunque veda
 * il conteggio finito puo' chiamarla, cosi' l'aggiudicazione non dipende dal
 * browser di una sola persona. Il server accetta solo se la scadenza e' passata.
 */
export async function aggiudicaSeScaduta(sessioneId: string) {
  const { data, error } = await client().rpc('aggiudica_se_scaduta', { p_sessione: sessioneId })
  if (error) throw new Error(error.message)
  return data
}

/**
 * Sospende l'asta: il conteggio si ferma dov'e'. Il server salva quanto mancava
 * al martello e cancella la scadenza, perche' durante la pausa un istante
 * assoluto scorrerebbe via da solo.
 */
export async function sospendiAsta(sessioneId: string, adminToken: string) {
  const { data, error } = await client().rpc('sospendi_asta', {
    p_sessione: sessioneId,
    p_admin_token: adminToken,
  })
  if (error) throw new Error(error.message)
  return data
}

/** Riprende dal punto esatto in cui si era fermata. */
export async function riprendiAsta(sessioneId: string, adminToken: string) {
  const { data, error } = await client().rpc('riprendi_asta', {
    p_sessione: sessioneId,
    p_admin_token: adminToken,
  })
  if (error) throw new Error(error.message)
  return data
}

export async function annullaChiamata(sessioneId: string, adminToken: string) {
  const { error } = await client().rpc('annulla_chiamata', {
    p_sessione: sessioneId,
    p_admin_token: adminToken,
  })
  if (error) throw new Error(error.message)
}

export async function aggiornaImpostazioni(args: {
  sessioneId: string
  adminToken: string
  rilancioMinimo: number
  attesaSecondi: number
  secondiDa1A2: number
  secondiDa2A3: number
  rilanciRapidi: number[]
  attesaOffertaMs: number
}) {
  const { error } = await client().rpc('aggiorna_impostazioni', {
    p_sessione: args.sessioneId,
    p_admin_token: args.adminToken,
    p_rilancio_minimo: args.rilancioMinimo,
    p_attesa_secondi: args.attesaSecondi,
    p_secondi_1_2: args.secondiDa1A2,
    p_secondi_2_3: args.secondiDa2A3,
    p_rilanci_rapidi: args.rilanciRapidi,
    p_attesa_offerta_ms: args.attesaOffertaMs,
  })
  if (error) throw new Error(error.message)
}

export async function rilancia(args: {
  sessioneId: string
  squadraId: string
  claimToken: string
  offerta: number
  /**
   * Versione della chiamata su cui l'offerta è stata calcolata. Va passata dai
   * rilanci rapidi, che valgono solo sulla base che si stava guardando, e
   * lasciata vuota dalle offerte libere, che sono cifre volute a prescindere.
   */
  versioneAttesa?: number | null
}): Promise<EsitoRilancio> {
  const { data, error } = await client().rpc('rilancia', {
    p_sessione: args.sessioneId,
    p_squadra: args.squadraId,
    p_claim_token: args.claimToken,
    p_offerta: args.offerta,
    p_versione_attesa: args.versioneAttesa ?? null,
  })
  if (error) throw new Error(error.message)
  return data as EsitoRilancio
}

// ------------------------------------------------------------- stato live --

export interface StatoLive {
  sessione: SessioneRow | null
  squadre: SquadraRow[]
  assegnazioni: AssegnazioneRow[]
  chiamata: ChiamataRow | null
  connesso: boolean
  caricato: boolean
  errore: string | null
  ricarica: () => void
}

/**
 * Segue una sessione in tempo reale.
 *
 * Alla riconnessione **rilegge tutto da capo** invece di applicare le
 * differenze arrivate nel frattempo: durante uno stacco i messaggi si perdono,
 * e applicare un delta su uno stato incompleto è il modo più rapido per
 * mostrare un tabellone sbagliato.
 */
export function useLive(sessioneId: string | null): StatoLive {
  const [sessione, setSessione] = useState<SessioneRow | null>(null)
  const [squadre, setSquadre] = useState<SquadraRow[]>([])
  const [assegnazioni, setAssegnazioni] = useState<AssegnazioneRow[]>([])
  const [chiamata, setChiamata] = useState<ChiamataRow | null>(null)
  const [connesso, setConnesso] = useState(false)
  const [caricato, setCaricato] = useState(false)
  const [errore, setErrore] = useState<string | null>(null)
  const [nonce, setNonce] = useState(0)
  const vivo = useRef(true)
  /** Quanti tentativi di riaggancio falliti di fila: serve a distanziarli */
  const tentativi = useRef(0)
  /** Letto dal giro di rilettura per decidere quanto stringere la cadenza */
  const inChiamata = useRef(false)

  const ricarica = useCallback(() => setNonce((n) => n + 1), [])

  const leggiTutto = useCallback(async (id: string) => {
    const db = client()
    const [s, sq, asg, ch] = await Promise.all([
      db.from('sessione').select('*').eq('id', id).maybeSingle(),
      db.from('squadra').select('*').eq('sessione_id', id).order('ordine'),
      db.from('assegnazione').select('*').eq('sessione_id', id),
      db.from('chiamata').select('*').eq('sessione_id', id).maybeSingle(),
    ])
    if (!vivo.current) return
    if (s.error) throw new Error(s.error.message)
    setSessione((s.data as SessioneRow) ?? null)
    setSquadre((sq.data as SquadraRow[]) ?? [])
    setAssegnazioni((asg.data as AssegnazioneRow[]) ?? [])
    setChiamata((ch.data as ChiamataRow) ?? null)
    setCaricato(true)
  }, [])

  /**
   * Rilettura leggera della sola chiamata: una riga, ed è quella che cambia in
   * continuazione mentre si rilancia. Serve a tenere il prezzo aggiornato anche
   * quando il canale realtime si è staccato senza dirlo.
   */
  const leggiChiamata = useCallback(async (id: string) => {
    const { data } = await client().from('chiamata').select('*').eq('sessione_id', id).maybeSingle()
    if (!vivo.current || !data) return
    const riga = data as ChiamataRow
    setChiamata(riga)
    // Chiamata appena chiusa: il tabellone e le rose sono cambiati, e aspettare
    // il giro lento significherebbe mostrarli vecchi per dieci secondi.
    if (inChiamata.current && riga.stato !== 'active') void leggiTutto(id).catch(() => {})
  }, [leggiTutto])

  // Un ref invece di una dipendenza: il giro di rilettura non deve essere
  // smontato e rimontato a ogni rilancio.
  useEffect(() => {
    inChiamata.current = chiamata?.stato === 'active'
  }, [chiamata])

  useEffect(() => {
    vivo.current = true
    if (!sessioneId || !supabase) {
      /* eslint-disable-next-line react/set-state-in-effect */
      setCaricato(true)
      return
    }
    // L'effetto qui e' al suo posto: apre e chiude la sottoscrizione a Supabase,
    // e lo stato riflette l'esito di quella connessione.
    /* eslint-disable-next-line react/set-state-in-effect */
    setCaricato(false)
    /* eslint-disable-next-line react/set-state-in-effect */
    setErrore(null)

    void sincronizzaOrologio()
    leggiTutto(sessioneId).catch((e) => vivo.current && setErrore(String(e.message ?? e)))

    let riaggancio: ReturnType<typeof setTimeout> | undefined

    const filtro = `sessione_id=eq.${sessioneId}`
    const canale = supabase
      .channel(`asta-${sessioneId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'assegnazione', filter: filtro }, (p) => {
        if (p.eventType === 'DELETE') {
          setAssegnazioni((prev) => prev.filter((a) => a.id !== (p.old as AssegnazioneRow).id))
        } else {
          const riga = p.new as AssegnazioneRow
          setAssegnazioni((prev) => [...prev.filter((a) => a.id !== riga.id), riga])
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chiamata', filter: filtro }, (p) => {
        setChiamata(p.new as ChiamataRow)
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'squadra', filter: filtro }, (p) => {
        const riga = p.new as SquadraRow
        setSquadre((prev) => prev.map((s) => (s.id === riga.id ? riga : s)).sort((a, b) => a.ordine - b.ordine))
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sessione', filter: `id=eq.${sessioneId}` }, (p) => {
        setSessione(p.new as SessioneRow)
      })
      .subscribe((stato) => {
        const attivo = stato === 'SUBSCRIBED'
        setConnesso(attivo)
        if (attivo) {
          tentativi.current = 0
          // Tornati online si rilegge tutto: i messaggi persi non si recuperano
          leggiTutto(sessioneId).catch(() => {})
          return
        }
        // Un canale che va in errore resta morto: supabase-js riaggancia il
        // socket, non necessariamente la singola sottoscrizione. Nell'asta del
        // 2026 questo lasciava qualcuno con le cifre ferme, aggiornate solo dal
        // giro periodico. Qui lo si ricostruisce da capo, distanziando i
        // tentativi per non intasare la rete se la linea è davvero giù.
        // 'CLOSED' arriva anche nella chiusura normale: rientrarci farebbe un
        // ciclo infinito a ogni smontaggio.
        if (stato === 'CHANNEL_ERROR' || stato === 'TIMED_OUT') {
          const attesa = Math.min(10000, 500 * 2 ** tentativi.current)
          tentativi.current += 1
          riaggancio = setTimeout(() => {
            if (vivo.current) ricarica()
          }, attesa)
        }
      })

    // Rete di sicurezza, e dopo l'asta del 2026 è la rete che regge davvero il
    // peso: il realtime è diventato un'ottimizzazione, non una dipendenza.
    //
    // Due cadenze. Mentre un giocatore è in asta si rilegge la sola chiamata
    // ogni secondo, perché è lì che una cifra vecchia fa danno: chi rilancia
    // deve vedere il prezzo giusto. Fuori dalla chiamata basta un giro completo
    // ogni dieci secondi. Otto telefoni che leggono una riga al secondo sono
    // pochi byte, e il costo si paga solo nei minuti in cui serve.
    let giro = 0
    const periodico = setInterval(() => {
      giro += 1
      if (inChiamata.current) leggiChiamata(sessioneId).catch(() => {})
      if (giro % 10 === 0) leggiTutto(sessioneId).catch(() => {})
    }, 1000)

    // L'orologio va risincronizzato ogni tanto: su un'asta di tre ore la deriva
    // di un telefono è sufficiente a far vedere il conteggio sfasato.
    const orologio = setInterval(() => {
      void sincronizzaOrologio(1)
    }, 300000)


    // Sul telefono il socket muore quando si blocca lo schermo: al ritorno
    // conviene rileggere subito invece di aspettare il giro periodico.
    const alRitorno = () => {
      if (document.visibilityState === 'visible') leggiTutto(sessioneId).catch(() => {})
    }
    document.addEventListener('visibilitychange', alRitorno)

    const db = supabase
    return () => {
      vivo.current = false
      clearInterval(periodico)
      clearInterval(orologio)
      clearTimeout(riaggancio)
      document.removeEventListener('visibilitychange', alRitorno)
      void db.removeChannel(canale)
    }
  }, [sessioneId, leggiTutto, leggiChiamata, ricarica, nonce])

  return { sessione, squadre, assegnazioni, chiamata, connesso, caricato, errore, ricarica }
}
