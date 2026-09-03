/**
 * Il conteggio "uno, due, tre" non viene trasmesso dal server: viaggia una sola
 * informazione, l'istante di scadenza, e ogni dispositivo ricava da solo in che
 * fase si trova. Cosi' tutti vedono la stessa cosa senza bisogno di messaggi a
 * ripetizione, e chi si riconnette a meta' conteggio si riallinea da solo.
 *
 * Linea del tempo dopo l'ultima offerta:
 *
 *   |<--- attesa --->|<- da1a2 ->|<- da2a3 ->|<- da2a3 ->|
 *   offerta        "uno"       "due"       "tre"     aggiudicato
 *
 * Il "tre" resta in vista quanto l'intervallo fra il due e il tre: e' il battito
 * che nell'asta vera separa l'ultimo numero dal colpo di martello.
 */

export interface TimerConfig {
  /** Secondi dall'ultima offerta all'inizio del conteggio */
  attesaSecondi: number
  /** Secondi fra "uno" e "due" */
  secondiDa1A2: number
  /** Secondi fra "due" e "tre", e fra "tre" e l'aggiudicazione */
  secondiDa2A3: number
}

export type Conteggio =
  | { fase: 'attesa'; rimanenti: number; alConteggio: number }
  | { fase: 'conteggio'; numero: 1 | 2 | 3; rimanenti: number; alProssimo: number }
  | { fase: 'scaduta'; rimanenti: 0 }

/** Durata totale di una chiamata senza rilanci, in secondi. */
export function durataTotale(cfg: TimerConfig): number {
  return cfg.attesaSecondi + cfg.secondiDa1A2 + 2 * cfg.secondiDa2A3
}

/**
 * @param scadenzaMs istante di scadenza (epoch ms), come lo manda il server
 * @param oraMs      ora corrente *corretta* con lo scarto del server
 */
export function conteggio(scadenzaMs: number, oraMs: number, cfg: TimerConfig): Conteggio {
  const rimanenti = (scadenzaMs - oraMs) / 1000
  if (rimanenti <= 0) return { fase: 'scaduta', rimanenti: 0 }

  const a = Math.max(1, cfg.secondiDa1A2)
  const b = Math.max(1, cfg.secondiDa2A3)

  if (rimanenti > a + 2 * b) {
    return { fase: 'attesa', rimanenti, alConteggio: rimanenti - (a + 2 * b) }
  }
  if (rimanenti > 2 * b) {
    return { fase: 'conteggio', numero: 1, rimanenti, alProssimo: rimanenti - 2 * b }
  }
  if (rimanenti > b) {
    return { fase: 'conteggio', numero: 2, rimanenti, alProssimo: rimanenti - b }
  }
  return { fase: 'conteggio', numero: 3, rimanenti, alProssimo: rimanenti }
}

/** Etichetta breve da mostrare a schermo. */
export function etichetta(c: Conteggio): string {
  switch (c.fase) {
    case 'attesa':
      return Math.ceil(c.alConteggio).toString()
    case 'conteggio':
      return ['', 'UNO', 'DUE', 'TRE'][c.numero]
    case 'scaduta':
      return 'AGGIUDICATO'
  }
}
