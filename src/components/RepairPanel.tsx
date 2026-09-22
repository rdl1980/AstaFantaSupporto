import { useMemo, useState } from 'react'
import {
  budgetTotale,
  perditeSvincoli,
  problemiRosa,
  rendimentoRosa,
  rimborsoDi,
  sostituti,
} from '../riparazione'
import { maxBidFor, teamStats, useStore } from '../store'
import type { Player } from '../types'

/**
 * Il mercato di riparazione.
 *
 * L'asta estiva e' un problema di acquisizione: si parte da zero e si riempiono
 * le caselle. Gennaio e' un problema di sostituzione, e le domande sono altre:
 * chi mi sta facendo male, quanto mi torna se lo svincolo, e cosa ci prendo con
 * quei crediti.
 */
/** "1 difensore" invece di "1 difensori": le etichette dei reparti sono plurali. */
function etichettaReparto(label: string, quanti: number): string {
  if (quanti !== 1) return label.toLowerCase()
  const singolari: Record<string, string> = {
    Portieri: 'portiere',
    Difensori: 'difensore',
    Centrocampisti: 'centrocampista',
    Attaccanti: 'attaccante',
    Movimento: 'giocatore di movimento',
  }
  return singolari[label] ?? label.toLowerCase()
}

export function RepairPanel({ onPick }: { onPick: (p: Player) => void }) {
  const { state, dispatch, myTeamId, playersById } = useStore()
  const { riparazione, diffListone } = state
  const [scelto, setScelto] = useState<number | null>(null)
  const [vediDiff, setVediDiff] = useState(true)

  const stats = teamStats(state, myTeamId)
  const rendimento = useMemo(() => rendimentoRosa(state, myTeamId), [state, myTeamId])
  const problemi = useMemo(() => problemiRosa(state, myTeamId), [state, myTeamId])
  const mieiSvincoli = useMemo(
    () => state.svincoli.filter((s) => s.teamId === myTeamId).sort((a, b) => b.svincolatoIl - a.svincolatoIl),
    [state.svincoli, myTeamId],
  )

  const rigaScelta = rendimento.find((r) => r.playerId === scelto)
  const rimborsoScelto = rigaScelta
    ? rimborsoDi(riparazione, rigaScelta.prezzo, rigaScelta.player, state.config.mode)
    : 0
  // Non "quanto ho in cassa" ma "quanto avrei dopo averlo svincolato": sono due
  // cifre diverse, ed e' la seconda che decide lo scambio.
  const creditiDopo = maxBidFor(state, myTeamId) + rimborsoScelto
  const alternative = useMemo(
    () => (scelto == null ? [] : sostituti(state, myTeamId, scelto, creditiDopo)),
    [state, myTeamId, scelto, creditiDopo],
  )

  return (
    <div className="riparazione">
      {diffListone && vediDiff && (
        <section className="card riparazione-diff">
          <div className="riparazione-diff-head">
            <h3>Cos&apos;è cambiato nel listone</h3>
            <button className="btn ghost small-btn" onClick={() => setVediDiff(false)}>
              ✕
            </button>
          </div>
          <p className="muted small">
            Dall&apos;import di <b>{diffListone.fileName}</b>: {diffListone.nuovi} giocatori nuovi,{' '}
            {diffListone.cambioSquadra.length} hanno cambiato squadra, {diffListone.usciti.length} hanno
            lasciato la Serie A.
          </p>
          {diffListone.svincoliForzati > 0 && (
            <p className="warn">
              ⚠ {diffListone.svincoliForzati} giocatori che erano in una rosa hanno lasciato la Serie A:
              sono diventati <b>svincoli forzati</b>, con i crediti restituiti per intero. Li trovi in
              fondo, segnati come forzati.
            </p>
          )}
          {diffListone.cambioSquadra.length > 0 && (
            <details className="riparazione-dettagli">
              <summary className="small">Chi ha cambiato squadra</summary>
              <ul className="small">
                {diffListone.cambioSquadra.map((c) => (
                  <li key={c.id}>
                    {c.nome} <span className="muted">{c.da} → {c.a}</span>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </section>
      )}

      <section className="card">
        <div className="riparazione-stato">
          <div>
            <h3>Finestra di gennaio</h3>
            <p className="muted small">
              {riparazione.aperta
                ? 'Aperta: gli svincoli restituiscono crediti e il budget aggiuntivo è in gioco.'
                : 'Chiusa. Aprila per svincolare e usare il budget aggiuntivo.'}
            </p>
          </div>
          <button
            className={`btn ${riparazione.aperta ? 'primary' : 'ghost'}`}
            onClick={() => dispatch({ type: 'setRiparazione', patch: { aperta: !riparazione.aperta } })}
          >
            {riparazione.aperta ? 'Chiudi la finestra' : 'Apri la finestra'}
          </button>
        </div>

        <div className="riparazione-crediti">
          <div>
            <span className="muted small">Budget</span>
            <b className="pt-num">{budgetTotale(state)}</b>
            {riparazione.aperta && riparazione.budgetExtra > 0 && (
              <span className="muted small"> di cui {riparazione.budgetExtra} nuovi</span>
            )}
          </div>
          <div>
            <span className="muted small">Residui</span>
            <b className="pt-num">{stats.remaining}</b>
          </div>
          <div>
            <span className="muted small">Persi negli svincoli</span>
            <b className={perditeSvincoli(state.svincoli, myTeamId) > 0 ? 'warn' : ''}>
              {perditeSvincoli(state.svincoli, myTeamId)}
            </b>
          </div>
        </div>

        {problemi.length > 0 && (
          <p className="warn small">
            ⚠ Rosa non valida:{' '}
            {problemi
              .map((p) =>
                p.chiave === 'FUORI'
                  ? `${p.scostamento} fuori dal listone`
                  : p.scostamento > 0
                    ? `${p.scostamento === 1 ? 'manca' : 'mancano'} ${p.scostamento} ${etichettaReparto(p.label, p.scostamento)}`
                    : `${-p.scostamento} ${etichettaReparto(p.label, -p.scostamento)} di troppo`,
              )
              .join(' · ')}
          </p>
        )}
      </section>

      <section className="card">
        <h3>Chi ti sta facendo male</h3>
        <p className="muted small">
          <b>Vale oggi</b> converte la quotazione di gennaio in crediti al cambio che questa lega ha
          praticato — la somma dei prezzi pagati divisa per la somma delle quotazioni. Confrontare
          direttamente prezzo e quotazione non direbbe nulla: sono scale diverse.
        </p>
        <table className="riparazione-tabella">
          <thead>
            <tr>
              <th>Giocatore</th>
              <th className="num">Pagato</th>
              <th className="num">Qt</th>
              <th className="num">Vale oggi</th>
              <th className="num">Scarto</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rendimento.map((r) => (
              <tr
                key={r.playerId}
                className={scelto === r.playerId ? 'scelta' : ''}
                onClick={() => setScelto(scelto === r.playerId ? null : r.playerId)}
              >
                <td>
                  <span className={`badge role-${r.ruolo}`}>{r.ruolo}</span> {r.nome}
                  {!r.player && <span className="warn small"> fuori dal listone</span>}
                </td>
                <td className="num">{r.prezzo}</td>
                <td className="num muted">{r.quotazione || '—'}</td>
                <td className="num">{r.valoreOggi}</td>
                <td className={`num ${r.scarto > 0 ? 'warn' : 'ok'}`}>
                  <b>{r.scarto > 0 ? `−${r.scarto}` : `+${-r.scarto}`}</b>
                </td>
                <td>
                  {riparazione.aperta && (
                    <button
                      className="btn danger small-btn"
                      onClick={(e) => {
                        e.stopPropagation()
                        dispatch({ type: 'svincola', playerId: r.playerId })
                        setScelto(null)
                      }}
                      title={`Svincola: ti tornano ${rimborsoDi(riparazione, r.prezzo, r.player, state.config.mode)} crediti`}
                    >
                      Svincola
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rendimento.length === 0 && <p className="muted small">Nessun giocatore in rosa.</p>}
      </section>

      {rigaScelta && (
        <section className="card">
          <h3>Al posto di {rigaScelta.nome}</h3>
          <p className="muted small">
            Svincolandolo ti tornano <b>{rimborsoScelto}</b> crediti: potresti arrivare a{' '}
            <b>{creditiDopo}</b>. Il costo stimato è la quotazione convertita allo stesso cambio. Sono
            elencati anche i giocatori più deboli di lui: dopo uno svincolo quello slot va riempito
            comunque.
          </p>
          {alternative.length === 0 ? (
            <p className="muted small">Nessun giocatore libero in questo reparto.</p>
          ) : (
            <ul className="riparazione-sostituti">
              {alternative.map((a) => (
                <li key={a.player.id} className={a.allaPortata ? '' : 'fuori'}>
                  <button className="link-btn" onClick={() => onPick(a.player)}>
                    <span className={`badge role-${a.player.r}`}>{a.player.r}</span> {a.player.name}{' '}
                    <span className="muted small">{a.player.team}</span>
                  </button>
                  <span className="small">
                    <span className="muted">Qt</span> <b>{a.quotazione}</b>{' '}
                    {/* Il segno dice subito se e' un passo avanti o indietro */}
                    <span className={a.miglioramento > 0 ? 'ok' : a.miglioramento < 0 ? 'warn' : 'muted'}>
                      {a.miglioramento > 0 ? `+${a.miglioramento}` : a.miglioramento < 0 ? `−${-a.miglioramento}` : '='}
                    </span>{' '}
                    <span className="muted">≈</span> <b>{a.costoStimato}</b>
                    {!a.allaPortata && <span className="warn"> fuori portata</span>}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {mieiSvincoli.length > 0 && (
        <section className="card">
          <h3>Svincolati</h3>
          <ul className="riparazione-svincoli">
            {mieiSvincoli.map((s) => (
              <li key={s.playerId}>
                <span>
                  <span className={`badge role-${s.ruolo}`}>{s.ruolo}</span> {s.nome}{' '}
                  <span className="muted small">{s.club}</span>
                  {s.forzato && <span className="warn small"> forzato</span>}
                </span>
                <span className="small">
                  <span className="muted">pagato</span> {s.price} <span className="muted">→ resi</span>{' '}
                  <b>{s.rimborso}</b>
                  {s.price !== s.rimborso && <span className="warn"> ({s.price - s.rimborso} persi)</span>}
                </span>
                <button
                  className="btn ghost small-btn"
                  onClick={() => dispatch({ type: 'annullaSvincolo', playerId: s.playerId })}
                  disabled={!playersById.has(s.playerId)}
                  title={
                    playersById.has(s.playerId)
                      ? 'Rimettilo in rosa'
                      : 'Non è più nel listone: non può rientrare'
                  }
                >
                  Annulla
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
