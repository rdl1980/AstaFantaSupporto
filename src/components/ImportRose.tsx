import { useMemo, useRef, useState } from 'react'
import { abbinaRose, leggiRoseCsv } from '../csvRose'
import type { LetturaRoseCsv } from '../csvRose'
import { leggiCredBanditore } from '../live/banditore'
import { useStore } from '../store'

/**
 * Carica rose gia' esistenti dal CSV di fantacalcio.it: l'export che l'app sa
 * gia' scrivere, letto al contrario.
 *
 * L'accoppiamento delle squadre si mostra sempre, anche quando i nomi tornano
 * tutti: una rosa intera finita sulla persona sbagliata e' un errore che si
 * scopre a meta' asta, e costa piu' dei dieci secondi di un'occhiata.
 */
export function ImportRose() {
  const { state, dispatch, activeAuction } = useStore()
  const fileRef = useRef<HTMLInputElement>(null)
  const [nomeFile, setNomeFile] = useState('')
  const [lettura, setLettura] = useState<LetturaRoseCsv | null>(null)
  const [scelte, setScelte] = useState<Record<string, string>>({})
  const [sostituisci, setSostituisci] = useState(true)
  const [esito, setEsito] = useState<string | null>(null)
  const [errore, setErrore] = useState<string | null>(null)

  const abbinamento = useMemo(
    () => (lettura ? abbinaRose(lettura, state, scelte) : null),
    [lettura, state, scelte],
  )

  async function leggi(file: File) {
    setErrore(null)
    setEsito(null)
    try {
      const testo = await file.text()
      const letto = leggiRoseCsv(testo)
      if (letto.righe.length === 0) {
        setLettura(null)
        setErrore(
          letto.ignorate > 0
            ? `Nessuna riga leggibile: ${letto.ignorate} righe non hanno la forma "squadra,id,prezzo"`
            : 'Il file non contiene rose',
        )
        return
      }
      setNomeFile(file.name)
      setScelte({})
      setLettura(letto)
    } catch (e) {
      setErrore(e instanceof Error ? e.message : 'Errore durante la lettura del file')
    }
  }

  function carica() {
    if (!abbinamento || abbinamento.acquisti.length === 0) return
    dispatch({ type: 'importRose', items: abbinamento.acquisti, sostituisci })
    setEsito(
      `${abbinamento.acquisti.length} acquisti caricati da ${nomeFile}` +
        (sostituisci ? ' al posto di quelli di prima' : ' sopra quelli esistenti'),
    )
    setLettura(null)
    setScelte({})
  }

  const senzaListone = state.players.length === 0
  // Con una sessione live avviata il tabellone sul server e' la verita': gli
  // acquisti che si tolgono qui tornerebbero su da soli al primo allineamento, e
  // quelli caricati salirebbero mescolati ai suoi. Meglio dirlo che lasciare che
  // l'import si disfi da se'.
  const conLive = leggiCredBanditore(activeAuction.id) !== null

  return (
    <section className="card">
      <h2>Rose da CSV</h2>
      <p className="muted">
        Carica rose che esistono già — quelle dell&apos;anno scorso, o di un&apos;altra lega — nello
        stesso formato CSV che il <b>Report</b> esporta: un blocco per squadra, una riga{' '}
        <code>squadra,id,prezzo</code> per giocatore. I giocatori si riconoscono dall&apos;id del
        listone, quindi il listone va importato prima.
      </p>

      <input
        ref={fileRef}
        type="file"
        accept=".csv,.txt"
        style={{ display: 'none' }}
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) void leggi(f)
          e.target.value = ''
        }}
      />
      <button className="btn" disabled={senzaListone || conLive} onClick={() => fileRef.current?.click()}>
        ⬆ Carica rose (.csv)
      </button>
      {senzaListone && <p className="warn small">Prima serve il listone: senza, gli id non hanno un giocatore.</p>}
      {conLive && (
        <p className="warn small">
          Questa asta è collegata a una sessione live: lì il tabellone sul server comanda, e le rose
          caricate qui si disferebbero al primo allineamento. Scollega la sessione dalla barra live,
          oppure carica le rose in un&apos;asta nuova.
        </p>
      )}

      {lettura && abbinamento && (
        <div className="import-box">
          <p className="small">
            <b>{nomeFile}</b> · {lettura.righe.length} righe ·{' '}
            {lettura.nomiSquadra.length} squadre nel file
            {lettura.ignorate > 0 && <span className="muted"> · {lettura.ignorate} righe ignorate</span>}
          </p>

          <ul className="import-results">
            {lettura.nomiSquadra.map((nome) => {
              const quante = lettura.righe.filter((r) => r.nomeSquadra === nome).length
              const scelto = abbinamento.mappa[nome] ?? ''
              return (
                <li key={nome} className={scelto ? '' : 'notfound'}>
                  <span className="import-raw" title={nome}>
                    {nome}
                  </span>
                  <select
                    value={scelto}
                    onChange={(e) => setScelte({ ...scelte, [nome]: e.target.value })}
                  >
                    <option value="">— non importare</option>
                    {state.config.teams.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                        {t.isMine ? ' (la mia)' : ''}
                      </option>
                    ))}
                  </select>
                  <span className="import-meta muted small">{quante} giocatori</span>
                </li>
              )
            })}
          </ul>

          {abbinamento.squadreIgnote.length > 0 && (
            <p className="warn small">
              Nessuna squadra dell&apos;asta si chiama{' '}
              {abbinamento.squadreIgnote.map((n) => `"${n}"`).join(', ')}: scegli tu a chi vanno, o
              lasciali fuori.
            </p>
          )}
          {abbinamento.fuoriListone.length > 0 && (
            <p className="warn small">
              {abbinamento.fuoriListone.length} giocatori non sono nel listone di quest&apos;anno e
              restano fuori (id {abbinamento.fuoriListone.slice(0, 8).join(', ')}
              {abbinamento.fuoriListone.length > 8 ? '…' : ''}).
            </p>
          )}
          {abbinamento.doppioni.length > 0 && (
            <p className="warn small">
              {abbinamento.doppioni.length} giocatori compaiono due volte: vale la prima riga.
            </p>
          )}
          {abbinamento.ceduti > 0 && (
            <p className="muted small">
              {abbinamento.ceduti} sono nel foglio Ceduti: entrano in rosa ma non sono più
              utilizzabili.
            </p>
          )}

          <div className="form-row">
            <label>
              Acquisti già registrati
              <select value={sostituisci ? 'sostituisci' : 'aggiungi'} onChange={(e) => setSostituisci(e.target.value === 'sostituisci')}>
                <option value="sostituisci">Sostituiscili con le rose del file</option>
                <option value="aggiungi">Tienili e aggiungi queste rose</option>
              </select>
            </label>
          </div>
          {sostituisci && state.purchases.length > 0 && (
            <p className="warn small">
              I {state.purchases.length} acquisti attuali e gli eventuali svincoli vengono buttati
              via. Se ti servono, fai prima un <b>Backup</b> dalla schermata d&apos;asta.
            </p>
          )}

          <div className="live-azioni-extra">
            <button className="btn primary" disabled={abbinamento.acquisti.length === 0} onClick={carica}>
              Carica {abbinamento.acquisti.length} acquisti
            </button>
            <button className="btn ghost" onClick={() => setLettura(null)}>
              Annulla
            </button>
          </div>
        </div>
      )}

      {esito && <p className="ok">{esito}</p>}
      {errore && <p className="error">{errore}</p>}
    </section>
  )
}
