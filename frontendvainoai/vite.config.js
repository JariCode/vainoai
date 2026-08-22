import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Kehityksessä sovellus pyörii juuressa (/), tuotannossa se julkaistaan
// alikansioon jaricode.fi/vainoai/. Ilman oikeaa base-polkua CSS- ja
// JS-tiedostoja ei löytyisi julkaistulta sivulta.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/vainoai/' : '/',
  plugins: [react()],
  server: {
    proxy: {
      // Kehityksessä /api-kutsut ohjataan paikalliselle taustapalvelimelle
      '/api': 'http://localhost:3001',
    },
  },
}))