import { useState } from 'react'
import type { CredenzialiBanditore } from './types'

const CHIAVE = 'asta-fanta-banditore-v1'

export function leggiCredBanditore(astaId: string): CredenzialiBanditore | null {
  try {
    const raw = localStorage.getItem(`${CHIAVE}:${astaId}`)
    return raw ? (JSON.parse(raw) as CredenzialiBanditore) : null
  } catch {
    return null
  }
}

export function salvaCredBanditore(astaId: string, c: CredenzialiBanditore | null): void {
  try {
    if (c) localStorage.setItem(`${CHIAVE}:${astaId}`, JSON.stringify(c))
    else localStorage.removeItem(`${CHIAVE}:${astaId}`)
  } catch {
    // storage non disponibile: la sessione resta valida solo finché la pagina è aperta
  }
}

/**
 * Credenziali della sessione live dell'asta indicata.
 *
 * Vivono qui e non dentro il pannello live perché servono anche alla schermata
 * d'asta: con una sessione avviata, il click sul listone deve mettere il
 * giocatore in trattativa invece di aprire il dialog di acquisto.
 */
export function useCredenzialiBanditore(astaId: string) {
  const [cred, setCred] = useState<CredenzialiBanditore | null>(() => leggiCredBanditore(astaId))
  const [astaVista, setAstaVista] = useState(astaId)

  // Aggiustamento in render al cambio di asta: ognuna ha la sua sessione
  if (astaVista !== astaId) {
    setAstaVista(astaId)
    setCred(leggiCredBanditore(astaId))
  }

  function aggiorna(c: CredenzialiBanditore | null) {
    salvaCredBanditore(astaId, c)
    setCred(c)
  }

  return [cred, aggiorna] as const
}
