// API-osoite yhdestä paikasta.
// Kehityksessä käytetään Viten välityspalvelinta (/api -> localhost:3001).
// Tuotannossa (julkaistu sivu) osoite tulee VITE_API_URL-muuttujasta.
export const API_URL = import.meta.env.DEV
  ? '/api'
  : import.meta.env.VITE_API_URL