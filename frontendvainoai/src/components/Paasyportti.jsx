import { useState } from 'react'
import './Paasyportti.css'

// Pääsyportti: kysyy pääsykoodin ennen kuin Väinö tulee näkyviin.
// Kun koodi on oikein, se välitetään ylös (onAvattu) ja tallennetaan
// pyyntöjen otsakkeeseen.
function Paasyportti({ onAvattu }) {
  const [koodi, setKoodi] = useState('')
  const [virhe, setVirhe] = useState('')
  const [tarkistaa, setTarkistaa] = useState(false)

  const tarkista = async () => {
    if (!koodi.trim()) return
    setTarkistaa(true)
    setVirhe('')
    try {
      const r = await fetch('/api/tarkista', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-paasykoodi': koodi.trim(),
        },
      })
      if (r.ok) {
        onAvattu(koodi.trim())
      } else {
        setVirhe('Koodi ei täsmää. Yritä uudelleen.')
      }
    } catch {
      setVirhe('Yhteys ei toiminut. Yritä hetken kuluttua.')
    } finally {
      setTarkistaa(false)
    }
  }

  const painallus = (e) => {
    if (e.key === 'Enter') tarkista()
  }

  return (
    <div className="portti-sivu">
      <div className="portti-laatikko">
        <h1 className="portti-otsikko">Väinö</h1>
        <p className="portti-teksti">Väinö odottaa. Anna pääsykoodi, niin pääset juttelemaan.</p>
        <input
          className="portti-kentta"
          type="password"
          value={koodi}
          onChange={(e) => setKoodi(e.target.value)}
          onKeyDown={painallus}
          placeholder="Pääsykoodi"
          autoFocus
        />
        <button className="portti-nappi" onClick={tarkista} disabled={tarkistaa}>
          {tarkistaa ? 'Hetkinen…' : 'Astu sisään'}
        </button>
        {virhe && <p className="portti-virhe">{virhe}</p>}
      </div>
    </div>
  )
}

export default Paasyportti