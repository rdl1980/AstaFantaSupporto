import { createClient } from '@supabase/supabase-js'
import type { SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

/**
 * L'app funziona anche senza Supabase configurato: in quel caso la parte live
 * resta semplicemente spenta e tutto il resto continua a funzionare in locale.
 */
export const liveDisponibile = Boolean(url && anonKey)

export const supabase: SupabaseClient | null = liveDisponibile
  ? createClient(url!, anonKey!, {
      auth: { persistSession: false },
      realtime: { params: { eventsPerSecond: 20 } },
    })
  : null

// ---------------------------------------------------------------- orologio --

/**
 * Scarto fra l'orologio del server e quello di questo dispositivo.
 *
 * Serve perché il conteggio "uno, due, tre" è calcolato da ogni client a
 * partire dall'istante di scadenza: un telefono con l'ora indietro di dieci
 * secondi mostrerebbe un conteggio diverso da tutti gli altri, e continuerebbe
 * a rilanciare quando l'asta è già chiusa.
 */
let scartoMs = 0
let scartoMisurato = false

export function oraServer(): number {
  return Date.now() + scartoMs
}

export function scartoOrologio(): { ms: number; misurato: boolean } {
  return { ms: scartoMs, misurato: scartoMisurato }
}

export async function sincronizzaOrologio(tentativi = 3): Promise<number> {
  if (!supabase) return 0
  let migliore: { rtt: number; scarto: number } | null = null
  for (let i = 0; i < tentativi; i++) {
    const t0 = Date.now()
    const { data, error } = await supabase.rpc('ora_server')
    const t1 = Date.now()
    if (error || !data) continue
    const rtt = t1 - t0
    // Si assume che l'andata valga metà del giro completo
    const scarto = new Date(data as string).getTime() - (t0 + rtt / 2)
    if (!migliore || rtt < migliore.rtt) migliore = { rtt, scarto }
  }
  if (migliore) {
    scartoMs = Math.round(migliore.scarto)
    scartoMisurato = true
  }
  return scartoMs
}
