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
  intervalloSecondi: number
}): Promise<{ sessioneId: string; codice: string; adminToken: string }> {
  const { data, error } = await client().rpc('crea_sessione', {
    p_nome: args.nome,
    p_modalita: args.modalita,
    p_budget: args.budget,
    p_slot_config: args.slotConfig,
    p_squadre: args.squadre,
    p_rilancio_minimo: args.rilancioMinimo,
    p_attesa_secondi: args.attesaSecondi,
    p_intervallo_secondi: args.intervalloSecondi,
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
  intervalloSecondi: number
}) {
  const { error } = await client().rpc('aggiorna_impostazioni', {
    p_sessione: args.sessioneId,
    p_admin_token: args.adminToken,
    p_rilancio_minimo: args.rilancioMinimo,
    p_attesa_secondi: args.attesaSecondi,
    p_intervallo_secondi: args.intervalloSecondi,
  })
  if (error) throw new Error(error.message)
}

export async function rilancia(args: {
  sessioneId: string
  squadraId: string
  claimToken: string
  offerta: number
}): Promise<EsitoRilancio> {
  const { data, error } = await client().rpc('rilancia', {
    p_sessione: args.sessioneId,
    p_squadra: args.squadraId,
    p_claim_token: args.claimToken,
    p_offerta: args.offerta,
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
        // Tornati online si rilegge tutto: i messaggi persi non si recuperano
        if (attivo) leggiTutto(sessioneId).catch(() => {})
      })

    // Rete di sicurezza. Misurando la latenza sul progetto vero si e' visto che
    // nei primi istanti dopo SUBSCRIBED la replica non consegna ancora: un
    // cambiamento che cade in quella finestra sfugge sia alla rilettura fatta
    // alla sottoscrizione sia alla sottoscrizione stessa. Una rilettura
    // periodica leggera chiude il buco senza che nessuno resti su una schermata
    // vecchia.
    const periodico = setInterval(() => {
      leggiTutto(sessioneId).catch(() => {})
    }, 10000)

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
      document.removeEventListener('visibilitychange', alRitorno)
      void db.removeChannel(canale)
    }
  }, [sessioneId, leggiTutto, nonce])

  return { sessione, squadre, assegnazioni, chiamata, connesso, caricato, errore, ricarica }
}
