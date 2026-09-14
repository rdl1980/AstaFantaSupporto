import { useMemo } from 'react'
import { CAMPIONE_MINIMO, etichettaInflazione, inflazione } from '../inflazione'
import { pressione } from '../pressione'
import { teamStats, useStore } from '../store'
import { CLASSIC_ROLE_ORDER } from '../types'

/**
 * Chi ha fame di cosa, e quanto sta pagando la stanza.
 *
 * Le due domande che ci si fa mentre un giocatore e' in trattativa e a cui la
 * scheda Squadre non risponde: se gli avversari possono seguirti, e se il prezzo
 * suggerito vale ancora qualcosa in questa asta.
 */
export function PressurePanel() {
  const { state, suggestions } = useStore()

  const righe = useMemo(() => pressione(state, (id) => teamStats(state, id)), [state])
  const infl = useMemo(() => inflazione(state, suggestions), [state, suggestions])

  return (
    <div className="pressione">
      <section className="card pressione-inflazione">
        <h3>Inflazione dell&apos;asta</h3>
        {infl.scostamento === null ? (
          <p className="muted small">
            Servono almeno {CAMPIONE_MINIMO} acquisti con un prezzo suggerito per dire qualcosa: finora
            sono {infl.campione}.
          </p>
        ) : (
          <>
            <div className="pressione-grande">
              <b className={infl.scostamento > 0 ? 'warn' : 'ok'}>{etichettaInflazione(infl.scostamento)}</b>
              <span className="muted small">
                {infl.scostamento > 0 ? 'si paga sopra il suggerito' : 'si paga sotto il suggerito'} · {infl.pagato}{' '}
                crediti dove il suggerito diceva {infl.atteso}, su {infl.campione} acquisti
              </span>
            </div>
            <div className="pressione-reparti small">
              {CLASSIC_ROLE_ORDER.map((r) => {
                const q = infl.perReparto[r]
                return (
                  <span key={r} title={`${q.campione} acquisti`}>
                    <span className={`badge role-${r}`}>{r}</span>{' '}
                    <b className={q.scostamento === null ? 'muted' : q.scostamento > 0 ? 'warn' : 'ok'}>
                      {etichettaInflazione(q.scostamento)}
                    </b>
                  </span>
                )
              })}
            </div>
            <p className="muted small">
              Nella barra di chiamata il suggerito compare anche ritarato su questi numeri: è il prezzo
              a cui quel giocatore andrebbe al ritmo di <i>questa</i> asta, non a quello del listino.
            </p>
          </>
        )}
      </section>

      <section className="card">
        <h3>Chi ha fame di cosa</h3>
        <p className="muted small">
          Ordinate per <b>crediti per slot</b>: quanto resta a ciascuno per ogni casella ancora vuota. È
          il tetto medio che può tenere da qui alla fine, e dice se al prossimo rilancio potrà seguirti.
        </p>
        <table className="pressione-tabella">
          <thead>
            <tr>
              <th>Squadra</th>
              <th>Deve ancora prendere</th>
              <th className="num">Residui</th>
              <th className="num">Per slot</th>
              <th className="num">Max</th>
            </tr>
          </thead>
          <tbody>
            {righe.map((r) => (
              <tr key={r.teamId} className={r.mia ? 'mia' : ''}>
                <td>
                  {r.nome} {r.mia && <span className="muted small">(io)</span>}
                </td>
                <td className="pressione-mancanti">
                  {r.mancanti.length === 0 ? (
                    <span className="ok small">rosa completa</span>
                  ) : (
                    r.mancanti.map((m) => (
                      <span key={m.chiave} title={m.label}>
                        <span className={`badge role-${m.chiave === 'MOV' ? 'D' : m.chiave}`}>
                          {m.chiave === 'MOV' ? 'MOV' : m.chiave}
                        </span>
                        <b className="small">{m.quanti}</b>
                      </span>
                    ))
                  )}
                </td>
                <td className="num">{r.residui}</td>
                {/* La cifra che separa "ha crediti" da "li deve spendere" */}
                <td className="num">
                  <b className="big-num">{r.slotMancanti > 0 ? r.perSlot : '—'}</b>
                </td>
                <td className="num muted">{r.maxOfferta}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="muted small">
          Chi ha la rosa completa non compare con un valore per slot: i crediti che gli avanzano non
          comprano più niente e non fanno pressione su nessuno. In Mantra i reparti sono portieri e
          movimento, perché i giocatori di movimento non hanno quote per ruolo.
        </p>
      </section>
    </div>
  )
}
