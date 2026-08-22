// Äänittää mikrofonin, lopettaa automaattisesti kun puhuja hiljenee,
// ja lähettää äänen backendille tunnistettavaksi base64-muodossa.
// Toimii kaikissa moderneissa selaimissa, myös Firefoxissa.

const HILJAISUUS_MS = 2000      // kuinka pitkä tauko lopettaa äänityksen
const HILJAISUUS_RAJA = 8       // äänenvoimakkuuden kynnys (0–255), alle tämän = hiljaisuus
const MAKSIMI_MS = 20000        // varmuusraja: äänitys ei jatku loputtomiin

export function aanitaJaTunnista() {
  return new Promise((resolve, reject) => {
    if (!navigator.mediaDevices || !window.MediaRecorder) {
      reject(new Error('Selaimesi ei tue äänen nauhoitusta.'))
      return
    }

    // Paremmat laatuasetukset parantavat tunnistustarkkuutta
    navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    }).then((stream) => {
      // Valitaan nauhoitusmuoto: webm/opus jos selain tukee (Chrome ja Firefox
      // tukevat molemmat). Yhtenäinen muoto parantaa tunnistusta.
      let recorderOptions = {}
      if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
        recorderOptions = { mimeType: 'audio/webm;codecs=opus' }
      } else if (MediaRecorder.isTypeSupported('audio/webm')) {
        recorderOptions = { mimeType: 'audio/webm' }
      }

      const recorder = new MediaRecorder(stream, recorderOptions)
      const palat = []
      let hiljaisuusAjastin = null
      let maksimiAjastin = null

      // Äänenvoimakkuuden seuranta hiljaisuuden tunnistukseen
      const audioCtx = new AudioContext()
      const lahde = audioCtx.createMediaStreamSource(stream)
      const analyser = audioCtx.createAnalyser()
      analyser.fftSize = 256
      lahde.connect(analyser)
      const data = new Uint8Array(analyser.frequencyBinCount)
      let puhunutJotain = false

      const lopeta = () => {
        if (recorder.state !== 'inactive') recorder.stop()
      }

      const seuraaAanta = () => {
        analyser.getByteFrequencyData(data)
        const voimakkuus = data.reduce((a, b) => a + b, 0) / data.length

        if (voimakkuus > HILJAISUUS_RAJA) {
          puhunutJotain = true
          if (hiljaisuusAjastin) {
            clearTimeout(hiljaisuusAjastin)
            hiljaisuusAjastin = null
          }
        } else if (puhunutJotain && !hiljaisuusAjastin) {
          hiljaisuusAjastin = setTimeout(lopeta, HILJAISUUS_MS)
        }

        if (recorder.state === 'recording') requestAnimationFrame(seuraaAanta)
      }

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) palat.push(e.data)
      }

      recorder.onstop = async () => {
        clearTimeout(hiljaisuusAjastin)
        clearTimeout(maksimiAjastin)
        stream.getTracks().forEach((t) => t.stop())
        audioCtx.close()

        const aani = new Blob(palat, { type: recorder.mimeType })
        if (aani.size === 0) {
          resolve('')
          return
        }

        try {
          // Muunnetaan ääni base64 data-URL:ksi (toimii myös Firefoxissa)
          const dataUrl = await new Promise((res2, rej2) => {
            const reader = new FileReader()
            reader.onload = () => res2(reader.result)
            reader.onerror = () => rej2(new Error('Äänen luku epäonnistui.'))
            reader.readAsDataURL(aani)
          })

          const r = await fetch('/api/tunnista', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ audio: dataUrl }),
          })
          const tulos = await r.json()
          resolve(tulos.teksti || '')
        } catch (e) {
          reject(e)
        }
      }

      recorder.start(100)
      seuraaAanta()
      maksimiAjastin = setTimeout(lopeta, MAKSIMI_MS)
    }).catch((e) => {
      console.error('Mikrofonin käyttö epäonnistui:', e)
      reject(e)
    })
  })
}