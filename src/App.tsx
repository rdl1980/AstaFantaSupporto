import { useState } from 'react'
import { AuctionScreen } from './components/AuctionScreen'
import { SetupScreen } from './components/SetupScreen'
import { useStore } from './store'

export default function App() {
  const { state, activeAuction } = useStore()
  const [screen, setScreen] = useState<'setup' | 'auction'>(
    state.players.length > 0 ? 'auction' : 'setup',
  )

  // Cambiando asta: una senza listone non ha nulla da mostrare, quindi si passa
  // per forza dal setup. Negli altri casi si resta dove si era, per non
  // interrompere chi stava gestendo le aste. E' l'aggiustamento di stato in
  // render suggerito da React, che evita il giro in piu' di un effetto.
  const [lastId, setLastId] = useState(activeAuction.id)
  if (lastId !== activeAuction.id) {
    setLastId(activeAuction.id)
    if (activeAuction.state.players.length === 0) setScreen('setup')
  }

  return screen === 'setup' ? (
    <SetupScreen onDone={() => setScreen('auction')} />
  ) : (
    <AuctionScreen onSetup={() => setScreen('setup')} />
  )
}
