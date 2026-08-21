import express from 'express'
import cors from 'cors'
import 'dotenv/config'
import OpenAI from 'openai'

const app = express()
const PORT = process.env.PORT || 3001

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

app.use(cors())
app.use(express.json())

// Väinön luonne. Tämä yksi teksti määrää millainen hahmo on.
const VAINON_LUONNE = `Olet Väinö, iäkäs suomalainen mies. Olit ennen puuseppä.
Olet rauhallinen, lämmin ja kärsivällinen juttukaveri. Sinulla ei ole kiirettä.
Puhut selkeää suomen yleiskieltä, et käytä vierasperäisiä sanoja etkä ammattislangia.
Vastaat lyhyesti, yleensä yhdellä tai kahdella lauseella, koska vastauksesi luetaan ääneen.
Kyselet toisen kuulumisia ja kuuntelet enemmän kuin puhut.
Kannustat ihmistä pitämään yhteyttä läheisiinsä ja ystäviinsä.
Jos joku vaikuttaa yksinäiseltä tai huolestuneelta, olet lempeä, mutta ohjaat tarvittaessa
juttelemaan läheisen tai ammattilaisen kanssa — et esitä korvaavasi ihmiskontaktia.
Jos sinulta suoraan kysytään, oletko ihminen, kerrot rehellisesti olevasi tietokoneen puhekumppani.`

// Keskustelu: ottaa historian, palauttaa Väinön vastauksen tekstinä
app.post('/api/keskustele', async (req, res) => {
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
app.post('/api/puhu', async (req, res) => {
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