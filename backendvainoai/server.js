import express from 'express'
import cors from 'cors'
import 'dotenv/config'
import OpenAI, { toFile } from 'openai'

const app = express()
const PORT = process.env.PORT || 3001

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

// Suurempi JSON-raja, koska ääni tulee base64-muodossa rungossa
app.use(cors())
app.use(express.json({ limit: '15mb' }))

// Pääsykoodi: vain oikean koodin tietävät pääsevät juttelemaan Väinön kanssa.
// Koodi luetaan .env:stä (PAASYKOODI). Frontend lähettää sen otsakkeessa.
function vaadiPaasykoodi(req, res, next) {
  const annettu = req.get('x-paasykoodi')
  if (!process.env.PAASYKOODI) {
    // Jos koodia ei ole asetettu, päästetään läpi (kehityksen helpottamiseksi)
    return next()
  }
  if (annettu === process.env.PAASYKOODI) {
    return next()
  }
  return res.status(401).json({ virhe: 'Väärä pääsykoodi' })
}

// Väinön luonne. Tämä yksi teksti määrää millainen hahmo on.
const VAINON_LUONNE = `Olet Väinö, iäkäs suomalainen mies. Olit ennen puuseppä.
Olet rauhallinen, lämmin ja kärsivällinen juttukaveri. Sinulla ei ole kiirettä.
Puhut selkeää suomen yleiskieltä, et käytä vierasperäisiä sanoja etkä ammattislangia.
Vastaat lyhyesti, yleensä yhdellä tai kahdella lauseella, koska vastauksesi luetaan ääneen.
Kyselet toisen kuulumisia ja kuuntelet enemmän kuin puhut.
Kannustat ihmistä pitämään yhteyttä läheisiinsä ja ystäviinsä.
Jos joku vaikuttaa yksinäiseltä tai huolestuneelta, olet lempeä, mutta ohjaat tarvittaessa
juttelemaan läheisen tai ammattilaisen kanssa — et esitä korvaavasi ihmiskontaktia.
Jos sinulta suoraan kysytään, oletko ihminen, kerrot rehellisesti olevasi tietokoneen puhekumppani.
Jos käyttäjän viesti on epäselvä tai et ymmärrä sitä, älä esittäydy uudestaan, vaan pyydä ystävällisesti toistamaan.`

// Pääsykoodin tarkistus: frontend kutsuu tätä kun käyttäjä syöttää koodin
app.post('/api/tarkista', vaadiPaasykoodi, (req, res) => {
  res.json({ ok: true })
})

// Puheentunnistus: ottaa äänen base64 data-URL:na, palauttaa tekstin.
// Toimii kaikissa selaimissa, myös Firefoxissa.
app.post('/api/tunnista', vaadiPaasykoodi, async (req, res) => {
  try {
    const { audio } = req.body

    if (typeof audio !== 'string' || !audio) {
      return res.status(400).json({ virhe: 'Äänidataa ei annettu.' })
    }

    const match = audio.match(/^data:(audio\/[a-zA-Z0-9.+-]+|application\/octet-stream)(;[^;,]+)*;base64,(.+)$/)
    if (!match) {
      return res.status(400).json({ virhe: 'Virheellinen äänimuoto.' })
    }

    const mimeType = match[1]
    const base64Data = match[3]
    const buffer = Buffer.from(base64Data, 'base64')

    if (buffer.length > 10 * 1024 * 1024) {
      return res.status(400).json({ virhe: 'Äänileike on liian pitkä.' })
    }

    let ext
    if (mimeType.includes('webm')) {
      ext = 'webm'
    } else if (mimeType.includes('ogg')) {
      ext = 'ogg'
    } else if (mimeType.includes('mp4')) {
      ext = 'mp4'
    } else {
      const header = buffer.subarray(0, 4)
      if (header.toString('ascii') === 'OggS') {
        ext = 'ogg'
      } else if (header[0] === 0x1a && header[1] === 0x45 && header[2] === 0xdf && header[3] === 0xa3) {
        ext = 'webm'
      } else {
        ext = 'webm'
      }
    }

    const fileType = `audio/${ext}`
    const file = await toFile(buffer, `aani.${ext}`, { type: fileType })

    const tulos = await openai.audio.transcriptions.create({
      file,
      model: 'gpt-4o-transcribe',
      language: 'fi',
      prompt: 'Suomenkielinen keskustelu Väinön kanssa: tervehdyksiä, kysymyksiä ja kuulumisia. Esimerkiksi: Kuka sinä olet? Mitä sinulle kuuluu?',
    })

    res.json({ teksti: tulos.text })
  } catch (e) {
    console.error('Tunnistusvirhe:', e.message)
    res.status(502).json({ virhe: 'Puheentunnistus epäonnistui' })
  }
})

// Keskustelu: ottaa historian, palauttaa Väinön vastauksen tekstinä
app.post('/api/keskustele', vaadiPaasykoodi, async (req, res) => {
  try {
    const { viestit } = req.body
    if (!Array.isArray(viestit)) {
      return res.status(400).json({ virhe: 'viestit puuttuu' })
    }

    const vastaus = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: VAINON_LUONNE },
        ...viestit,
      ],
      temperature: 0.8,
      max_tokens: 200,
    })

    res.json({ vastaus: vastaus.choices[0].message.content })
  } catch (e) {
    console.error('Keskusteluvirhe:', e.message)
    res.status(500).json({ virhe: 'Vastauksen haku epäonnistui' })
  }
})

// Puhe: ottaa tekstin, palauttaa äänen (mp3) raakatavuina
app.post('/api/puhu', vaadiPaasykoodi, async (req, res) => {
  try {
    const { teksti } = req.body
    if (!teksti) {
      return res.status(400).json({ virhe: 'teksti puuttuu' })
    }

    const aani = await openai.audio.speech.create({
      model: 'gpt-4o-mini-tts',
      voice: 'onyx',
      input: teksti,
    })

    const puskuri = Buffer.from(await aani.arrayBuffer())
    res.set('Content-Type', 'audio/mpeg')
    res.send(puskuri)
  } catch (e) {
    console.error('Puhevirhe:', e.message)
    res.status(500).json({ virhe: 'Puheen luonti epäonnistui' })
  }
})

app.listen(PORT, () => {
  console.log(`VäinöAI-palvelin kuuntelee portissa ${PORT}`)
})