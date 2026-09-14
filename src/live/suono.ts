/**
 * Tono del conteggio sui telefoni.
 *
 * In una stanza di otto persone che parlano, il conteggio a schermo si perde: chi
 * guarda altrove scopre tardi di essere stato superato. Un tono corto su *uno,
 * due, tre* e uno diverso sull'aggiudicazione bastano a non doverci stare sopra
 * con gli occhi.
 *
 * I suoni sono sintetizzati, non file: pochi byte invece di un caricamento che
 * potrebbe non essere finito quando serve, e nessun problema di formati.
 */

let ctx: AudioContext | null = null

/** Il browser non lascia suonare finche' non c'e' stato un tocco. */
export async function sbloccaAudio(): Promise<boolean> {
  try {
    const Costruttore =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Costruttore) return false
    ctx ??= new Costruttore()
    if (ctx.state === 'suspended') await ctx.resume()
    return ctx.state === 'running'
  } catch {
    // Audio negato o non disponibile: il conteggio resta visibile, e basta
    return false
  }
}

/**
 * Una nota sola, con una salita e una discesa morbide: un'onda tagliata di netto
 * fa un "clic" che su un telefono suona come un guasto.
 */
function nota(frequenza: number, durataMs: number, ritardoMs = 0, volume = 0.25): void {
  if (!ctx || ctx.state !== 'running') return
  const inizio = ctx.currentTime + ritardoMs / 1000
  const fine = inizio + durataMs / 1000

  const osc = ctx.createOscillator()
  osc.type = 'sine'
  osc.frequency.value = frequenza

  const gain = ctx.createGain()
  gain.gain.setValueAtTime(0, inizio)
  gain.gain.linearRampToValueAtTime(volume, inizio + 0.012)
  gain.gain.setValueAtTime(volume, fine - 0.03)
  gain.gain.linearRampToValueAtTime(0, fine)

  osc.connect(gain).connect(ctx.destination)
  osc.start(inizio)
  osc.stop(fine + 0.02)
}

/**
 * Uno e due salgono, il tre e' piu' grave e piu' lungo: si riconosce il colpo di
 * martello senza contare i bip.
 */
export function suonaConteggio(numero: 1 | 2 | 3): void {
  if (numero === 3) nota(440, 320, 0, 0.3)
  else nota(numero === 1 ? 780 : 880, 110)
}

/** Due note che salgono: si distingue dal conteggio anche a mezzo orecchio. */
export function suonaAggiudicato(): void {
  nota(660, 130)
  nota(990, 260, 130)
}

/** Avviso breve quando qualcuno supera la tua offerta. */
export function suonaSuperato(): void {
  nota(520, 90)
  nota(390, 140, 95)
}
