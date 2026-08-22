import { useState, useRef, useCallback } from 'react'
import Vaino from './components/Vaino'
import Paasyportti from './components/Paasyportti'
import { aanitaJaTunnista } from './utils/puheentunnistus'
import { API_URL } from './api'
import './App.css'

function App() {
  const [paasykoodi, setPaasykoodi] = useState(() => sessionStorage.getItem('vaino-sessio'))
  const [tila, setTila] = useState('odottaa')
  const [teksti, setTeksti] = useState('Paina nappia ja juttele kanssani.')
  const [suunAvaus, setSuunAvaus] = useState(0)
  const historia = useRef([])

  // Sessiotunnus myös refissä, jotta pyynnöt lukevat aina tuoreimman arvon
  // (ei jää jumiin vanhaan closure-arvoon).
  const koodiRef = useRef(paasykoodi)

  const asetaSessio = (sessio) => {
    sessionStorage.setItem('vaino-sessio', sessio)
    koodiRef.current = sessio
    setPaasykoodi(sessio)
  }

  const haeVastaus = async (viestit) => {
    const r = await fetch(`${API_URL}/keskustele`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-sessio': koodiRef.current,
      },
      body: JSON.stringify({ viestit }),
    })
    if (!r.ok) {
      throw new Error('Vastauksen haku epäonnistui')
    }
    const data = await r.json()
    return data.vastaus
  }

  const puhu = async (sanat) => {
    const r = await fetch(`${API_URL}/puhu`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-sessio': koodiRef.current,
      },
      body: JSON.stringify({ teksti: sanat }),
    })
    // Jos backend palautti virheen (esim. 401/429), älä yritä dekoodata äänenä
    if (!r.ok) {
      throw new Error('Äänen haku epäonnistui')
    }
    const audioData = await r.arrayBuffer()
    await soitaAani(audioData, sanat)
  }

  const kasitteleKayttajanPuhe = useCallback(async (puhe) => {
    // Jos tunnistus jäi tyhjäksi tai liian lyhyeksi, pyydä toistamaan
    if (!puhe || puhe.trim().length < 3) {
      setTeksti('En kuullut kunnolla. Sanoisitko vielä uudestaan?')
      setTila('odottaa')
      return
    }
    setTila('ajattelee')
    historia.current.push({ role: 'user', content: puhe })

    try {
      const vastaus = await haeVastaus(historia.current)
      historia.current.push({ role: 'assistant', content: vastaus })
      setTeksti('')
      await puhu(vastaus)
    } catch (e) {
      console.error(e)
      setTeksti('Anteeksi, en nyt saanut sanaa suustani.')
      setTila('odottaa')
    }
  }, [])

  // Paina kerran: äänitys alkaa ja päättyy automaattisesti kun lopetat puhumisen
  const aloitaPuhuminen = useCallback(async () => {
    setTila('kuuntelee')
    try {
      const puhe = await aanitaJaTunnista(koodiRef.current)
      await kasitteleKayttajanPuhe(puhe)
    } catch (e) {
      console.error(e)
      setTila('odottaa')
    }
  }, [kasitteleKayttajanPuhe])

  // Soittaa äänen, liikuttaa suuta ja kirjoittaa tekstin äänen tahtiin
  const soitaAani = (audioData, sanat) => {
    return new Promise((resolve) => {
      const audioCtx = new AudioContext()
      audioCtx.decodeAudioData(audioData.slice(0), (buffer) => {
        const source = audioCtx.createBufferSource()
        source.buffer = buffer

        const analyser = audioCtx.createAnalyser()
        analyser.fftSize = 256
        source.connect(analyser)
        analyser.connect(audioCtx.destination)

        const data = new Uint8Array(analyser.frequencyBinCount)
        let loppui = false
        setTila('puhuu')
        source.start(0)

        // Teksti kirjoittuu ruudulle äänen keston mukaan
        const kesto = buffer.duration * 1000
        const merkkiVali = kesto / Math.max(sanat.length, 1)
        let i = 0
        const kirjoita = setInterval(() => {
          i++
          setTeksti(sanat.slice(0, i))
          if (i >= sanat.length) clearInterval(kirjoita)
        }, merkkiVali)

        // Suun liike äänen voimakkuuden mukaan
        const seuraa = () => {
          analyser.getByteFrequencyData(data)
          const voimakkuus = data.reduce((a, b) => a + b, 0) / data.length
          setSuunAvaus(Math.min(voimakkuus / 60, 1))
          if (!loppui) requestAnimationFrame(seuraa)
        }
        seuraa()

        source.onended = () => {
          loppui = true
          clearInterval(kirjoita)
          setTeksti(sanat)
          setSuunAvaus(0)
          setTila('odottaa')
          audioCtx.close()
          resolve()
        }
      })
    })
  }

  // Ennen sisäänpääsyä näytetään pääsyportti
  if (!paasykoodi) {
    return <Paasyportti onAvattu={asetaSessio} />
  }

  return (
    <div className="vaino-sivu">
      <Vaino tila={tila} suunAvaus={suunAvaus} />
      <p className="vaino-teksti">{teksti}</p>
      <button
        className="puhu-nappi"
        onClick={aloitaPuhuminen}
        disabled={tila !== 'odottaa'}
      >
        {tila === 'kuuntelee' && 'Kuuntelen…'}
        {tila === 'ajattelee' && 'Hetkinen…'}
        {tila === 'puhuu' && 'Väinö puhuu…'}
        {tila === 'odottaa' && 'Paina ja puhu'}
      </button>
    </div>
  )
}

export default App