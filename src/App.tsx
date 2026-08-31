import { useState } from 'react'
import { AuctionScreen } from './components/AuctionScreen'
import { SetupScreen } from './components/SetupScreen'
import { useStore } from './store'

export default function App() {
  const { state } = useStore()
  const [screen, setScreen] = useState<'setup' | 'auction'>(state.players.length > 0 ? 'auction' : 'setup')

  return screen === 'setup' ? (
    <SetupScreen onDone={() => setScreen('auction')} />
  ) : (
    <AuctionScreen onSetup={() => setScreen('setup')} />
  )
}
