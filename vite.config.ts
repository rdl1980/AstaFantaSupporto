import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  // Percorsi relativi: la build funziona sia in locale sia servita da una
  // sottocartella, come su GitHub Pages (/AstaFantaSupporto/).
  base: './',
  plugins: [react()],
})
