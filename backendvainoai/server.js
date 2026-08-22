import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import 'dotenv/config'
import OpenAI, { toFile } from 'openai'
import crypto from 'crypto'

const app = express()
const PORT = process.env.PORT || 3001

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

// Renderin (ja muiden proxyjen) takana: luota ensimmäiseen proxyyn, jotta
// rate limit tunnistaa oikean IP:n eikä proxyn osoitetta.
app.set('trust proxy', 1)

// --- Turvallisuusotsakkeet (Helmet) ---
// Tämä on JSON-API. HSTS pakottaa HTTPS:n, referrerPolicy ei vuoda osoitetta.
app.use(helmet({
  hsts: {
    maxAge: 31536000,          // 1 vuosi sekunteina
    includeSubDomains: true,
  },
  referrerPolicy: {
    policy: 'strict-origin-when-cross-origin',
  },
}))

// --- Permissions-Policy: API ei käytä selaimen ominaisuuksia, estetään kaikki ---
app.use((req, res, next) => {
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=()')
  next()
})

// --- CORS: sallitut originit ympäristömuuttujasta ---
// Tuotannossa origin on pakko asettaa (ei localhost-oletusta), kehityksessä
// localhost on oletus jos muuttujaa ei ole.
const defaultOrigins = process.env.NODE_ENV === 'production'
  ? ''
  : 'http://localhost:5173'

const allowedOrigins = (process.env.ALLOWED_ORIGINS || defaultOrigins)
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean)

app.use(cors({
  origin: (origin, callback) => {
    // Sallitaan pyynnöt ilman originia (palvelinten väliset) ja listalla olevat
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true)
    } else {
      callback(new Error('CORS: origin ei ole sallittu'))
    }
  },
}))

// Suurempi JSON-raja, koska ääni tulee base64-muodossa rungossa
app.use(express.json({ limit: '15mb' }))

// --- Pyyntörajoittimet (rate limit) ---
// Yleinen katto koko API:lle: estää spämmin mutta ei haittaa normaalia käyttöä.
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,               // 1 minuutti
  max: 60,                           // enintään 60 pyyntöä / IP / minuutti
  message: { virhe: 'Liikaa pyyntöjä. Hidasta hetkeksi.' },
  standardHeaders: true,
  legacyHeaders: false,
})

// Brute force -suoja pääsykoodille: harva syöttää koodia kymmeniä kertoja.
const koodiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,          // 15 minuuttia
  max: 8,                            // enintään 8 yritystä / IP / ikkuna
  message: { virhe: 'Liian monta yritystä. Yritä myöhemmin uudelleen.' },
  standardHeaders: true,
  legacyHeaders: false,
})

// OpenAI-kutsujen suoja (kustannukset): jokainen kutsu maksaa, joten tiukempi.
const openaiLimiter = rateLimit({
  windowMs: 60 * 1000,               // 1 minuutti
  max: 20,                           // enintään 20 kutsua / IP / minuutti
  message: { virhe: 'Lähetät liian nopeasti. Hetki.' },
  standardHeaders: true,
  legacyHeaders: false,
})

// Yleinen raja koko API:lle
app.use('/api', apiLimiter)

// --- Pääsy: pääsykoodilla saa sessiotunnuksen, jota käytetään koodin sijaan ---
// Voimassa olevat sessiotunnukset muistissa. Tunnus = satunnainen merkkijono,
// arvo = vanhenemisaika (ms). Ei tietokantaa, joten tunnukset katoavat kun
// palvelin käynnistetään uudelleen (käyttäjä syöttää koodin silloin uudelleen).
const sessiot = new Map()
const SESSION_KESTO_MS = 12 * 60 * 60 * 1000   // 12 tuntia

// Luo uusi sessiotunnus ja tallentaa sen voimassaoloajan kanssa
function luoSessio() {
  const tunnus = crypto.randomBytes(32).toString('hex')
  sessiot.set(tunnus, Date.now() + SESSION_KESTO_MS)
  return tunnus
}

// Tarkistaa onko sessiotunnus voimassa (ja siivoaa vanhentuneet)
function onVoimassa(tunnus) {
  if (typeof tunnus !== 'string' || !sessiot.has(tunnus)) return false
  const vanhenee = sessiot.get(tunnus)
  if (Date.now() > vanhenee) {
    sessiot.delete(tunnus)
    return false
  }
  return true
}

// Vartija: suojatut reitit vaativat voimassa olevan sessiotunnuksen.
// Itse pääsykoodi ei koskaan kulje näissä pyynnöissä, vain sessiotunnus.
function vaadiSessio(req, res, next) {
  if (!process.env.PAASYKOODI) {
    return next()   // jos koodia ei ole asetettu, päästetään läpi (kehitys)
  }
  const tunnus = req.get('x-sessio')
  if (onVoimassa(tunnus)) {
    return next()
  }
  return res.status(401).json({ virhe: 'Sessio ei ole voimassa' })
}

// --- Syötteen siivous: poistaa ohjausmerkit ja rajaa pituuden ---
// Estää roskasyötteen ja suojaa mallia oudoilta ohjausmerkeiltä.
function siivoaTeksti(arvo, maksimi = 4000) {
  if (typeof arvo !== 'string') return ''
  return arvo
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '') // ohjausmerkit pois
    .slice(0, maksimi)
    .trim()
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

// Yksinkertainen terveystarkistus juureen (siisti vastaus, ei virhekoodia)
app.get('/', (req, res) => {
  res.json({ status: 'VäinöAI-palvelin käynnissä' })
})

// Pääsykoodin tarkistus (oma brute force -raja). Palauttaa sessiotunnuksen.
app.post('/api/tarkista', koodiLimiter, (req, res) => {
  const annettu = req.get('x-paasykoodi')

  // Kehityksessä ilman koodia: annetaan silti sessiotunnus
  if (!process.env.PAASYKOODI) {
    return res.json({ ok: true, sessio: luoSessio() })
  }

  if (typeof annettu === 'string' && annettu === process.env.PAASYKOODI) {
    return res.json({ ok: true, sessio: luoSessio() })
  }

  return res.status(401).json({ virhe: 'Väärä pääsykoodi' })
})

// Puheentunnistus: ottaa äänen base64 data-URL:na, palauttaa tekstin.
app.post('/api/tunnista', openaiLimiter, vaadiSessio, async (req, res) => {
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
app.post('/api/keskustele', openaiLimiter, vaadiSessio, async (req, res) => {
  try {
    const { viestit } = req.body
    if (!Array.isArray(viestit)) {
      return res.status(400).json({ virhe: 'viestit puuttuu' })
    }

    // Rajaa historian pituus ja siivoa jokainen viesti.
    // Estää liian ison pyynnön ja roskasyötteen mallille.
    const puhtaatViestit = viestit
      .slice(-20)                                    // enintään 20 viimeisintä
      .filter((v) => v && (v.role === 'user' || v.role === 'assistant'))
      .map((v) => ({
        role: v.role,
        content: siivoaTeksti(v.content, 2000),
      }))
      .filter((v) => v.content.length > 0)

    if (puhtaatViestit.length === 0) {
      return res.status(400).json({ virhe: 'Ei kelvollisia viestejä' })
    }

    const vastaus = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: VAINON_LUONNE },
        ...puhtaatViestit,
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
app.post('/api/puhu', openaiLimiter, vaadiSessio, async (req, res) => {
  try {
    const teksti = siivoaTeksti(req.body?.teksti, 1000)
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