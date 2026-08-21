// Selaimen oma puheentunnistus (Web Speech API). Ilmainen, toimii parhaiten Chromessa.
export function kaynnistaKuuntelu({ onValmis, onVirhe }) {
  const SpeechRecognition =
    window.SpeechRecognition || window.webkitSpeechRecognition

  if (!SpeechRecognition) {
    alert('Selaimesi ei tue puheentunnistusta. Kokeile Chromea.')
    onVirhe?.()
    return
  }

  const tunnistus = new SpeechRecognition()
  tunnistus.lang = 'fi-FI'
  tunnistus.interimResults = false
  tunnistus.maxAlternatives = 1

  tunnistus.onresult = (e) => {
    const puhe = e.results[0][0].transcript
    onValmis?.(puhe)
  }

  tunnistus.onerror = (e) => {
    console.error('Puheentunnistuksen virhe:', e.error)
    onVirhe?.(e.error)
  }

  tunnistus.start()
  return tunnistus
}