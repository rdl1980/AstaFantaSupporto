import { useEffect, useRef } from 'react'
import type { Action } from '../store'
import type { AppState, Purchase } from '../types'
import { leggiCredBanditore } from './banditore'
import { pubblicaAssegnazione, rimuoviAssegnazione } from './session'
import type { StatoLive } from './session'
import type { CredenzialiBanditore } from './types'

/**
 * Tiene allineati l'asta locale e la sessione live, nei due sensi.
 *
 * Serve perché tutto il resto dell'app — rosa, budget, scarsità, moduli, report,
 * export — legge gli acquisti locali: senza questo, un giocatore aggiudicato dai
 * telefoni resterebbe solo sul server e l'app del banditore continuerebbe a
 * mostrare una rosa vuota.
 *
 * Un acquisto presente da una parte sola viene copiato dall'altra. Si cancella
 * soltanto cio' che il server aveva e non ha piu': un acquisto registrato in
 * locale e non ancora salito non deve sparire per questo. Le cancellazioni
 * partono da `rimuoviAcquisto`, che le manda anche al server.
 */
/**
 * Cancellazioni chieste e non ancora confermate dal server.
 *
 * Servono perché fra la richiesta di cancellazione e l'arrivo della notifica
 * passa qualche decimo di secondo: in quella finestra l'allineamento legge un
 * elenco ancora vecchio, rimetterebbe il giocatore in locale, e la
 * sincronizzazione in salita lo ricaricherebbe sul server, annullando di fatto
 * la cancellazione. Finché il server non conferma, quel giocatore viene
 * ignorato in entrambi i sensi.
 */
const cancellazioniInCorso = new Set<string>()

const chiave = (astaId: string, playerId: number) => `${astaId}:${playerId}`

export function useSincronizzaAcquisti(
  astaId: string,
  cred: CredenzialiBanditore | null,
  live: StatoLive,
  state: AppState,
  dispatch: (a: Action) => void,
): void {
  const inVolo = useRef(new Set<number>())
  // Memoria di quali giocatori sono passati dal server: senza, non si potrebbe
  // distinguere "non e' mai stato lassu'" da "il server l'ha cancellato", e una
  // cancellazione verrebbe annullata al primo allineamento.
  const vistiDalServer = useRef(new Set<number>())

  // ---- dal server all'asta locale ----
  useEffect(() => {
    if (!cred || !live.caricato || live.squadre.length === 0) return
    // Le squadre sono accoppiate per posizione: il numero di partecipanti è
    // fissato alla creazione dell'asta, quindi la corrispondenza non cambia.
    const localePerLive = new Map<string, string>()
    live.squadre.forEach((s, i) => {
      const locale = state.config.teams[i]
      if (locale) localePerLive.set(s.id, locale.id)
    })

    const items: Purchase[] = []
    const sulServer = new Set<number>()
    for (const a of live.assegnazioni) {
      sulServer.add(a.giocatore_id)
      // Cancellazione chiesta e non ancora confermata: non va rimesso dentro
      if (cancellazioniInCorso.has(chiave(astaId, a.giocatore_id))) continue
      const teamId = localePerLive.get(a.squadra_id)
      if (!teamId) continue
      items.push({
        playerId: a.giocatore_id,
        teamId,
        price: a.prezzo,
        ts: new Date(a.assegnato_il).getTime(),
      })
    }

    // Spariti dal server dopo esserci stati: vanno tolti anche in locale.
    // Si esclude cio' che e' ancora in viaggio verso il server, altrimenti un
    // acquisto appena registrato verrebbe cancellato prima di arrivare.
    const remove: number[] = []
    for (const id of vistiDalServer.current) {
      if (!sulServer.has(id) && !inVolo.current.has(id)) remove.push(id)
    }
    for (const id of remove) vistiDalServer.current.delete(id)
    for (const id of sulServer) vistiDalServer.current.add(id)

    // Il server conferma la sparizione: la cancellazione e' andata a buon fine
    for (const k of [...cancellazioniInCorso]) {
      const [asta, id] = k.split(':')
      if (asta === astaId && !sulServer.has(Number(id))) cancellazioniInCorso.delete(k)
    }

    if (items.length > 0 || remove.length > 0) {
      dispatch({ type: 'mergeLivePurchases', items, remove })
    }
  }, [astaId, cred, live.caricato, live.assegnazioni, live.squadre, state.config.teams, dispatch])

  // ---- dall'asta locale al server ----
  useEffect(() => {
    if (!cred || !live.caricato || live.squadre.length === 0) return
    const sulServer = new Set(live.assegnazioni.map((a) => a.giocatore_id))
    const livePerLocale = new Map<string, string>()
    state.config.teams.forEach((t, i) => {
      const remota = live.squadre[i]
      if (remota) livePerLocale.set(t.id, remota.id)
    })

    for (const pu of state.purchases) {
      if (sulServer.has(pu.playerId) || inVolo.current.has(pu.playerId)) continue
      // Non si ricarica cio' che si sta cancellando
      if (cancellazioniInCorso.has(chiave(astaId, pu.playerId))) continue
      const squadraId = livePerLocale.get(pu.teamId)
      const pl = state.players.find((p) => p.id === pu.playerId)
      if (!squadraId || !pl) continue

      inVolo.current.add(pu.playerId)
      void pubblicaAssegnazione({
        sessioneId: cred.sessioneId,
        adminToken: cred.adminToken,
        squadraId,
        giocatoreId: pl.id,
        nome: pl.name,
        club: pl.team,
        ruolo: pl.r,
        ruoliMantra: pl.rm.join(';'),
        prezzo: pu.price,
      })
        .catch(() => {})
        .finally(() => inVolo.current.delete(pu.playerId))
    }
  }, [astaId, cred, live.caricato, live.assegnazioni, live.squadre, state.purchases, state.players, state.config.teams])
}

/**
 * Cancella un acquisto anche sulla sessione live, se ce n'è una.
 *
 * Senza questo passaggio la cancellazione durerebbe un istante: l'allineamento
 * dal server rimetterebbe subito il giocatore al suo posto.
 */
export function rimuoviAcquisto(
  dispatch: (a: Action) => void,
  astaId: string,
  playerId: number,
): void {
  dispatch({ type: 'removePurchase', playerId })
  const cred = leggiCredBanditore(astaId)
  if (!cred) return
  cancellazioniInCorso.add(chiave(astaId, playerId))
  void rimuoviAssegnazione(cred.sessioneId, cred.adminToken, playerId).catch(() => {
    // Se la cancellazione non arriva al server, l'allineamento deve poter
    // rimettere il giocatore: meglio un acquisto di troppo che uno perso.
    cancellazioniInCorso.delete(chiave(astaId, playerId))
  })
}

/** Annulla l'ultimo acquisto registrato, propagandolo alla sessione live. */
export function annullaUltimoAcquisto(
  dispatch: (a: Action) => void,
  astaId: string,
  purchases: Purchase[],
): void {
  if (purchases.length === 0) return
  const ultimo = purchases.reduce((a, b) => (a.ts > b.ts ? a : b))
  rimuoviAcquisto(dispatch, astaId, ultimo.playerId)
}
