import { useEffect, useState } from 'react'
import './Vaino.css'

// Väinö — iäkäs, lämmin hahmo. Suu liikkuu suunAvaus-arvon (0–1) mukaan,
// silmät räpsyvät satunnaisesti, hahmo hengittää levossakin.
function Vaino({ tila, suunAvaus }) {
  const [silmatKiinni, setSilmatKiinni] = useState(false)

  useEffect(() => {
    let ajastin
    const rapayta = () => {
      setSilmatKiinni(true)
      setTimeout(() => setSilmatKiinni(false), 130)
      ajastin = setTimeout(rapayta, 2500 + Math.random() * 4000)
    }
    ajastin = setTimeout(rapayta, 2500)
    return () => clearTimeout(ajastin)
  }, [])

  const suunKorkeus = 3 + suunAvaus * 34

  return (
    <div className={`vaino-hahmo tila-${tila}`}>
      <svg viewBox="0 0 440 560" className="vaino-svg" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <radialGradient id="iho" cx="50%" cy="42%" r="65%">
            <stop offset="0%" stopColor="#f3cdaa" />
            <stop offset="70%" stopColor="#e6b58f" />
            <stop offset="100%" stopColor="#cf9a73" />
          </radialGradient>
          <linearGradient id="pusero" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#4a5c4a" />
            <stop offset="100%" stopColor="#38473a" />
          </linearGradient>
          <linearGradient id="hiukset" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#eceff1" />
            <stop offset="100%" stopColor="#c3c9cd" />
          </linearGradient>
        </defs>

        <path d="M60 560 Q70 430 150 400 Q220 380 290 400 Q370 430 380 560 Z" fill="url(#pusero)" />
        <path d="M150 400 Q220 430 290 400 L290 415 Q220 448 150 415 Z" fill="#2f3b31" opacity="0.5" />

        <path d="M180 380 Q220 405 260 380 L258 430 Q220 448 182 430 Z" fill="#d9a179" />

        <ellipse cx="98" cy="250" rx="22" ry="34" fill="url(#iho)" />
        <ellipse cx="342" cy="250" rx="22" ry="34" fill="url(#iho)" />

        <ellipse cx="220" cy="240" rx="140" ry="165" fill="url(#iho)" />

        <path d="M150 150 Q220 132 290 150" stroke="#c48f68" strokeWidth="3" fill="none" opacity="0.5" />
        <path d="M158 172 Q220 156 282 172" stroke="#c48f68" strokeWidth="3" fill="none" opacity="0.4" />

        <path d="M92 235 Q80 120 220 108 Q360 120 348 235 Q352 175 300 150 Q220 130 140 150 Q88 175 92 235 Z" fill="url(#hiukset)" />

        <path d="M120 205 Q158 188 196 202 Q158 198 120 212 Z" fill="#b9bfc2" />
        <path d="M244 202 Q282 188 320 205 Q282 198 244 212 Z" fill="#b9bfc2" />

        {silmatKiinni ? (
          <>
            <path d="M136 235 Q162 244 192 235" stroke="#6b4f38" strokeWidth="4" fill="none" strokeLinecap="round" />
            <path d="M248 235 Q278 244 304 235" stroke="#6b4f38" strokeWidth="4" fill="none" strokeLinecap="round" />
          </>
        ) : (
          <>
            <ellipse cx="164" cy="234" rx="20" ry="15" fill="#fff" />
            <ellipse cx="276" cy="234" rx="20" ry="15" fill="#fff" />
            <circle cx="168" cy="235" r="9" fill="#5a6b7a" />
            <circle cx="272" cy="235" r="9" fill="#5a6b7a" />
            <circle cx="168" cy="235" r="4" fill="#2b2b2b" />
            <circle cx="272" cy="235" r="4" fill="#2b2b2b" />
            <path d="M142 250 Q164 258 188 250" stroke="#c48f68" strokeWidth="2.5" fill="none" opacity="0.5" />
            <path d="M252 250 Q276 258 300 250" stroke="#c48f68" strokeWidth="2.5" fill="none" opacity="0.5" />
          </>
        )}

        <path d="M220 245 Q210 300 200 312 Q220 326 240 312 Q230 300 220 245 Z" fill="#dba57c" />
        <ellipse cx="207" cy="312" rx="7" ry="5" fill="#c78f65" opacity="0.6" />
        <ellipse cx="233" cy="312" rx="7" ry="5" fill="#c78f65" opacity="0.6" />

        <ellipse cx="130" cy="300" rx="30" ry="20" fill="#e8967a" opacity="0.3" />
        <ellipse cx="310" cy="300" rx="30" ry="20" fill="#e8967a" opacity="0.3" />

        <ellipse cx="220" cy="360" rx="42" ry={suunKorkeus / 2} fill="#7c3b38" />
        <ellipse cx="220" cy={360 + suunKorkeus / 4} rx="30" ry={suunKorkeus / 6} fill="#5a2725" opacity="0.7" />

        <path d="M168 345 Q220 336 272 345 Q248 356 220 354 Q192 356 168 345 Z" fill="#d5dadd" />
        <path d="M170 372 Q160 415 185 442 Q220 458 255 442 Q280 415 270 372 Q245 400 220 400 Q195 400 170 372 Z" fill="#cfd5d9" opacity="0.92" />
      </svg>
    </div>
  )
}

export default Vaino