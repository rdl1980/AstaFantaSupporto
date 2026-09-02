/** Righe come arrivano da Supabase. */

export interface SessioneRow {
  id: string
  codice: string
  nome: string
  modalita: 'mantra' | 'classic'
  budget: number
  slot_config: { slot?: Record<string, number>; portieri?: number; movimento?: number }
  rilancio_minimo: number
  attesa_secondi: number
  intervallo_secondi: number
  stato: 'idle' | 'active' | 'paused' | 'closed'
}

export interface SquadraRow {
  id: string
  sessione_id: string
  nome: string
  ordine: number
  /** true se qualcuno l'ha già rivendicata; il token non è mai esposto in lettura */
  presa: boolean
}

export interface AssegnazioneRow {
  id: string
  sessione_id: string
  squadra_id: string
  giocatore_id: number
  giocatore_nome: string
  club: string
  ruolo_classic: 'P' | 'D' | 'C' | 'A'
  ruoli_mantra: string | null
  prezzo: number
  assegnato_il: string
}

export interface ChiamataRow {
  sessione_id: string
  giocatore_id: number | null
  giocatore_nome: string | null
  club: string | null
  ruolo_classic: 'P' | 'D' | 'C' | 'A' | null
  ruoli_mantra: string | null
  offerta_attuale: number | null
  miglior_offerente_id: string | null
  stato: 'idle' | 'active' | 'paused'
  scadenza: string | null
  versione: number
}

/** Identità salvata sul dispositivo di chi partecipa. */
export interface CredenzialiPartecipante {
  codice: string
  sessioneId: string
  squadraId: string
  claimToken: string
}

/** Identità del banditore, salvata insieme all'asta locale. */
export interface CredenzialiBanditore {
  codice: string
  sessioneId: string
  adminToken: string
}

export type EsitoRilancio =
  | { ok: true; offerta: number; versione: number }
  | {
      ok: false
      motivo:
        | 'offerta_superata'
        | 'rilancio_troppo_basso'
        | 'crediti_insufficienti'
        | 'slot_ruolo_pieni'
        | 'chiamata_scaduta'
        | 'nessuna_chiamata'
        | 'non_autorizzato'
        | 'gia_tua'
        | 'sessione_inesistente'
      offerta_attuale?: number
      minima?: number
      massimo?: number
      ruolo?: string
      versione?: number
    }

export const MOTIVO_LEGGIBILE: Record<string, string> = {
  offerta_superata: 'Qualcuno ha già offerto di più',
  rilancio_troppo_basso: 'Devi rilanciare di almeno il minimo',
  crediti_insufficienti: 'Non hai abbastanza crediti',
  slot_ruolo_pieni: 'Hai già completato gli slot per questo ruolo',
  chiamata_scaduta: 'Troppo tardi: la chiamata è chiusa',
  nessuna_chiamata: 'Nessun giocatore in asta',
  non_autorizzato: 'Non risulti abilitato per questa squadra',
  gia_tua: 'L’offerta più alta è già tua',
  sessione_inesistente: 'Sessione non trovata',
}
