import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ParticipantApp } from './live/ParticipantApp.tsx'
import { StoreProvider } from './store.tsx'

// Con ?asta=CODICE si entra come partecipante: schermata a sé, pensata per il
// telefono, che non carica il listone né lo stato locale del banditore.
const codice = new URLSearchParams(window.location.search).get('asta')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {codice ? (
      <ParticipantApp codice={codice.trim().toUpperCase()} />
    ) : (
      <StoreProvider>
        <App />
      </StoreProvider>
    )}
  </StrictMode>,
)
