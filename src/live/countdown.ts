/**
 * Il conteggio "uno, due, tre" non viene trasmesso dal server: viaggia una sola
 * informazione, l'istante di scadenza, e ogni dispositivo ricava da solo in che
 * fase si trova. Cosi' tutti vedono la stessa cosa senza bisogno di messaggi a
 * ripetizione, e chi si riconnette a meta' conteggio si riallinea da solo.
 *
 * Linea del tempo dopo l'ultima offerta:
 *
 *   |<--- attesa --->|<- da1a2 ->|<- da2a3 ->|
 *   offerta        "uno"       "due"       "tre" = aggiudicato
 *
 * Il "tre" e' il colpo di martello: da quell'istante il server non accetta piu'
 * offerte. Sullo schermo "TRE" e "AGGIUDICATO" restano insieme per qualche
 * secondo, il tempo di far leggere com'e' finita.
 */

export interface TimerConfig {
  /** Secondi dall'ultima offerta all'inizio del conteggio */
  attesaSecondi: number
  /** Secondi fra "uno" e "due" */
  secondiDa1A2: number
  /** Secondi fra "due" e "tre". Al "tre" la chiamata e' chiusa */
  secondiDa2A3: number
}

export type Conteggio =
  | { fase: 'attesa'; rimanenti: number; alConteggio: number }
  | { fase: 'conteggio'; numero: 1 | 2; rimanenti: number; alProssimo: number }
  /** Il "tre": offerte chiuse, giocatore aggiudicato */
  | { fase: 'scaduta'; rimanenti: 0 }

/** Durata totale di una chiamata senza rilanci, in secondi. */
export function durataTotale(cfg: TimerConfig): number {
  return cfg.attesaSecondi + cfg.secondiDa1A2 + cfg.secondiDa2A3
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

  if (rimanenti > a + b) {
    return { fase: 'attesa', rimanenti, alConteggio: rimanenti - (a + b) }
  }
  if (rimanenti > b) {
    return { fase: 'conteggio', numero: 1, rimanenti, alProssimo: rimanenti - b }
  }
  return { fase: 'conteggio', numero: 2, rimanenti, alProssimo: rimanenti }
}

/** Etichetta breve da mostrare a schermo. */
export function etichetta(c: Conteggio): string {
  switch (c.fase) {
    case 'attesa':
      return Math.ceil(c.alConteggio).toString()
    case 'conteggio':
      return ['', 'UNO', 'DUE'][c.numero]
    case 'scaduta':
      // Il tre coincide con l'aggiudicazione: si mostrano insieme
      return 'TRE'
  }
}
