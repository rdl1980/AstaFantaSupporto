import type {
  AppState,
  ClassicRole,
  DiffListone,
  Player,
  Purchase,
  Riparazione,
  Svincolo,
} from './types'
// Estensione esplicita, permessa da `allowImportingTsExtensions`: senza, questo
// modulo non si potrebbe collaudare con node, che gli import senza estensione
// non li risolve.
import { playerQt } from './types.ts'

/**
 * Il mercato di riparazione.
 *
 * L'asta estiva e' un problema di acquisizione: si parte da zero e si riempiono
 * le caselle. Gennaio e' un problema di sostituzione: la rosa c'e' gia', e la
 * domanda e' quale dei tuoi ti sta facendo male e cosa c'e' di meglio a quel
 * prezzo. Serve aritmetica diversa.
 */

// ------------------------------------------------------------- crediti ------

/** Crediti restituiti da uno svincolo, secondo la regola della lega. */
export function rimborsoDi(
  riparazione: Riparazione,
  price: number,
  player: Player | undefined,
  mode: 'mantra' | 'classic',
): number {
  switch (riparazione.rimborso) {
    case 'prezzo':
      return price
    case 'percentuale':
      return Math.max(0, Math.round((price * riparazione.rimborsoPercento) / 100))
    case 'quotazione':
      // Un giocatore sparito dal listone non ha piu' una quotazione. Restituire
      // zero punirebbe per una cessione che non hai deciso tu, quindi in quel
      // caso torna il prezzo pagato. E' la scelta piu' prudente delle due: se la
      // tua lega la pensa diversamente, il rimborso resta modificabile a mano.
      return player ? playerQt(player, mode) : price
  }
}

/** Quanto ha rimesso una squadra negli svincoli: la parte di prezzo non tornata. */
export function perditeSvincoli(svincoli: Svincolo[], teamId: string): number {
  return svincoli
    .filter((s) => s.teamId === teamId)
    .reduce((somma, s) => somma + (s.price - s.rimborso), 0)
}

/** Budget di una squadra, compreso l'eventuale extra di gennaio. */
export function budgetTotale(state: AppState): number {
  return state.config.budget + (state.riparazione.aperta ? state.riparazione.budgetExtra : 0)
}

/**
 * Trasforma un acquisto in uno svincolo.
 *
 * Nome, club e ruoli vengono copiati perche' uno svincolo forzato avviene
 * proprio quando il giocatore non e' piu' nel listone: cercarlo dopo non darebbe
 * niente, e la rosa storica diventerebbe illeggibile.
 */
export function creaSvincolo(
  state: AppState,
  acquisto: Purchase,
  player: Player | undefined,
  forzato: boolean,
  rimborso?: number,
): Svincolo {
  return {
    playerId: acquisto.playerId,
    teamId: acquisto.teamId,
    price: acquisto.price,
    ts: acquisto.ts,
    svincolatoIl: Date.now(),
    rimborso:
      rimborso ??
      // Uno svincolo forzato non l'hai scelto: restituire meno del prezzo
      // significherebbe farti pagare il mercato di gennaio della Serie A.
      (forzato ? acquisto.price : rimborsoDi(state.riparazione, acquisto.price, player, state.config.mode)),
    forzato,
    nome: player?.name ?? `Giocatore ${acquisto.playerId}`,
    club: player?.team ?? '',
    ruolo: player?.r ?? 'C',
    ruoliMantra: player?.rm ?? [],
  }
}

// -------------------------------------------------------- listone di gennaio -

/**
 * Cosa e' cambiato fra due listoni.
 *
 * A gennaio il file non e' un aggiornamento di prezzi: arrivano giocatori nuovi,
 * altri lasciano la Serie A, altri cambiano squadra. Chi e' uscito ed era in una
 * rosa e' la notizia urgente — prima veniva cancellato in silenzio insieme ai
 * suoi crediti.
 */
export function confrontaListoni(
  vecchi: Player[],
  nuovi: Player[],
  purchases: Purchase[],
  fileName: string,
): DiffListone {
  const primaPerId = new Map(vecchi.map((p) => [p.id, p]))
  const dopoPerId = new Map(nuovi.map((p) => [p.id, p]))
  const inRosa = new Set(purchases.map((p) => p.playerId))

  const cambioSquadra: DiffListone['cambioSquadra'] = []
  let nuoviIngressi = 0
  for (const p of nuovi) {
    const prima = primaPerId.get(p.id)
    if (!prima) {
      nuoviIngressi++
    } else if (prima.team !== p.team) {
      cambioSquadra.push({ id: p.id, nome: p.name, da: prima.team, a: p.team })
    }
  }

  const usciti = vecchi
    .filter((p) => !dopoPerId.has(p.id))
    .map((p) => ({ id: p.id, nome: p.name, club: p.team, ruolo: p.r }))

  return {
    quando: Date.now(),
    fileName,
    nuovi: nuoviIngressi,
    cambioSquadra: cambioSquadra.sort((a, b) => a.nome.localeCompare(b.nome)),
    usciti: usciti.sort((a, b) => a.nome.localeCompare(b.nome)),
    svincoliForzati: usciti.filter((u) => inRosa.has(u.id)).length,
  }
}

// ----------------------------------------------------------- rendimento -----

export interface RigaRendimento {
  player: Player | undefined
  playerId: number
  nome: string
  ruolo: ClassicRole
  prezzo: number
  /** Quotazione di gennaio; 0 se il giocatore non e' piu' nel listone */
  quotazione: number
  /** Quanto costerebbe oggi, al ritmo a cui questa lega paga le quotazioni */
  valoreOggi: number
  /** Prezzo meno valore: positivo = ci stai rimettendo */
  scarto: number
}

/**
 * Quanto rende ogni giocatore della rosa, adesso che mezzo campionato e' andato.
 *
 * Il confronto non puo' essere fra prezzo e quotazione: sono scale diverse, e un
 * giocatore pagato 200 e quotato 25 e' normale, non un disastro. Si converte
 * allora la quotazione in crediti usando il cambio che *questa lega* ha
 * praticato — la somma dei prezzi pagati divisa per la somma delle quotazioni —
 * e si confronta quello che hai pagato con quanto costerebbe oggi.
 *
 * Come per l'inflazione dell'asta, si usa il rapporto fra totali e non la media
 * dei rapporti: un giocatore da un credito distorcerebbe la media senza spostare
 * il mercato di nulla.
 */
export function rendimentoRosa(state: AppState, teamId: string): RigaRendimento[] {
  const perId = new Map(state.players.map((p) => [p.id, p]))
  const mode = state.config.mode
  const quota = (p: Player | undefined) => (p ? playerQt(p, mode) : 0)

  // Il cambio si misura su tutta la lega, non sulla singola rosa: con 29
  // giocatori il campione sarebbe troppo sottile e pieno di casi limite.
  let prezziTotali = 0
  let quoteTotali = 0
  for (const a of state.purchases) {
    const q = quota(perId.get(a.playerId))
    if (q <= 0) continue
    prezziTotali += a.price
    quoteTotali += q
  }
  const cambio = quoteTotali > 0 ? prezziTotali / quoteTotali : 0

  return state.purchases
    .filter((a) => a.teamId === teamId)
    .map((a) => {
      const player = perId.get(a.playerId)
      const quotazione = quota(player)
      const valoreOggi = Math.round(quotazione * cambio)
      return {
        player,
        playerId: a.playerId,
        nome: player?.name ?? `Giocatore ${a.playerId}`,
        ruolo: player?.r ?? 'C',
        prezzo: a.price,
        quotazione,
        valoreOggi,
        scarto: a.price - valoreOggi,
      }
    })
    .sort((a, b) => b.scarto - a.scarto)
}

// ------------------------------------------------------------- sostituti ----

export interface Sostituto {
  player: Player
  quotazione: number
  /** Quanto costerebbe oggi al cambio della lega */
  costoStimato: number
  /** Quanta quotazione guadagni rispetto a chi esce */
  miglioramento: number
  /** Ci arrivi con i crediti che avresti dopo lo svincolo */
  allaPortata: boolean
}

/**
 * Chi potresti prendere al posto di un tuo giocatore.
 *
 * Il vincolo non e' "quanto ho in cassa" ma "quanto avrei dopo averlo
 * svincolato": sono due cifre diverse, e la seconda e' quella che conta quando
 * decidi lo scambio.
 *
 * Si elencano i liberi del reparto anche quando nessuno e' piu' forte di chi
 * esce. Sembra inutile e non lo e': dopo uno svincolo forzato quello slot va
 * riempito comunque, e rispondere "non c'e' nessuno meglio di lui" lascerebbe a
 * mani vuote proprio quando serve una lista. Il segno di `miglioramento` dice
 * subito se e' un passo avanti o indietro.
 */
export function sostituti(
  state: AppState,
  teamId: string,
  playerId: number,
  creditiDopoSvincolo: number,
  limite = 12,
): Sostituto[] {
  const perId = new Map(state.players.map((p) => [p.id, p]))
  const uscente = perId.get(playerId)
  if (!uscente) return []
  const mode = state.config.mode
  const quotaUscente = playerQt(uscente, mode)

  const righe = rendimentoRosa(state, teamId)
  const rif = righe.find((r) => r.playerId === playerId)
  const cambio = rif && rif.quotazione > 0 ? rif.valoreOggi / rif.quotazione : 0

  const presi = new Set(state.purchases.map((a) => a.playerId))
  return state.players
    .filter((p) => !presi.has(p.id) && p.r === uscente.r)
    .map((p) => {
      const quotazione = playerQt(p, mode)
      const costoStimato = Math.max(1, Math.round(quotazione * cambio))
      return {
        player: p,
        quotazione,
        costoStimato,
        miglioramento: quotazione - quotaUscente,
        allaPortata: costoStimato <= creditiDopoSvincolo,
      }
    })
    // Prima quelli che puoi davvero permetterti: una lista che si apre con
    // giocatori fuori portata e' una lista di rimpianti, non di opzioni.
    .sort((a, b) => Number(b.allaPortata) - Number(a.allaPortata) || b.quotazione - a.quotazione)
    .slice(0, limite)
}

// --------------------------------------------------------- rosa valida ------

export interface ProblemaRosa {
  chiave: string
  label: string
  /** Positivo = ne mancano; negativo = ne hai troppi */
  scostamento: number
}

/**
 * Una rosa con cui non si puo' chiudere il mercato.
 *
 * Durante la riparazione si svincola prima e si compra dopo, quindi per un po'
 * la rosa e' per forza incompleta: questo serve a non dimenticarsene.
 */
export function problemiRosa(state: AppState, teamId: string): ProblemaRosa[] {
  const { config } = state
  const perId = new Map(state.players.map((p) => [p.id, p]))
  const mie = state.purchases.filter((a) => a.teamId === teamId)
  const conta = (f: (p: Player) => boolean) =>
    mie.filter((a) => {
      const p = perId.get(a.playerId)
      return p ? f(p) : false
    }).length

  const voci =
    config.mode === 'mantra'
      ? [
          { chiave: 'P', label: 'Portieri', ha: conta((p) => p.r === 'P'), vuole: config.mantraGk },
          { chiave: 'MOV', label: 'Movimento', ha: conta((p) => p.r !== 'P'), vuole: config.mantraOutfield },
        ]
      : (['P', 'D', 'C', 'A'] as ClassicRole[]).map((r) => ({
          chiave: r,
          label: { P: 'Portieri', D: 'Difensori', C: 'Centrocampisti', A: 'Attaccanti' }[r],
          ha: conta((p) => p.r === r),
          vuole: config.classicSlots[r],
        }))

  const problemi = voci
    .filter((v) => v.ha !== v.vuole)
    .map((v) => ({ chiave: v.chiave, label: v.label, scostamento: v.vuole - v.ha }))

  // Un giocatore che non sta piu' nel listone occupa uno slot ma non giochera'
  // mai: va contato fra i guai, non fra i presenti.
  const fantasmi = mie.filter((a) => !perId.has(a.playerId)).length
  if (fantasmi > 0) {
    problemi.push({ chiave: 'FUORI', label: 'Fuori dal listone', scostamento: fantasmi })
  }
  return problemi
}
