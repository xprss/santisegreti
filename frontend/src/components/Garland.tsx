import { useId, useMemo } from 'react'
import { seeded } from '../scene/random'

const TILE = 96
const HEIGHT = 34
const BRANCH_Y = 16

const PINE_BACK = ['#173F28', '#1B4A2F', '#1F5534']
const PINE_FRONT = ['#2A6B40', '#33794A', '#3F8A55', '#2F7245']

interface Needle {
  d: string
  color: string
}

/** Rametti di pino: aghi corti che partono da un ramo appena ondulato, su due strati. */
function pineNeedles(seed: number, palette: string[], lengthBase: number, count: number) {
  const rand = seeded(seed)
  const needles: Needle[] = []
  for (let i = 0; i < count; i++) {
    const x = (i / count) * TILE
    const y = BRANCH_Y + Math.sin((x / TILE) * Math.PI * 2) * 1.5
    for (const side of [-1, 1]) {
      const angle = ((side * (35 + rand() * 40) - 12) * Math.PI) / 180
      const length = lengthBase + rand() * 4
      const x2 = x + Math.cos(angle) * length * 0.55
      const y2 = y + Math.sin(angle) * length
      const color = palette[Math.floor(rand() * palette.length)]
      // Ogni ago è ripetuto anche una mattonella prima e dopo: il motivo non ha cuciture.
      for (const shift of [-TILE, 0, TILE]) {
        needles.push({ d: `M${x + shift} ${y} L${x2 + shift} ${y2}`, color })
      }
    }
  }
  return needles
}

/** Un rametto di pungitopo: foglie appuntite, lucide, con la bacca rossa al centro. */
function Ruscus({ x, y, flip = false }: { x: number; y: number; flip?: boolean }) {
  const leaves = [-38, 8, 52]
  return (
    <g transform={`translate(${x} ${y}) scale(${flip ? -1 : 1} 1)`}>
      {leaves.map((angle, i) => (
        <g key={angle} transform={`rotate(${angle})`}>
          <path
            d="M0 0 C4 -4.2 11 -4.6 17 0 C11 4.6 4 4.2 0 0 Z"
            fill={i === 1 ? '#145A32' : '#0F4A29'}
            stroke="#0A3A1F"
            strokeWidth="0.6"
          />
          <path d="M1.5 0 L15 0" stroke="#5E9C6E" strokeWidth="0.6" strokeLinecap="round" />
          <path d="M4 -1.6 C8 -3 12 -2.6 14.5 -1" stroke="#FFFFFF" strokeOpacity="0.28" strokeWidth="0.8" fill="none" strokeLinecap="round" />
        </g>
      ))}
      <circle cx="7.5" cy="1" r="2.6" fill="#C40C2B" />
      <circle cx="10.5" cy="3.6" r="2.3" fill="#A80A25" />
      <circle cx="6.8" cy="0.2" r="0.8" fill="#FFFFFF" opacity="0.75" />
      <circle cx="9.8" cy="2.8" r="0.7" fill="#FFFFFF" opacity="0.7" />
    </g>
  )
}

/** Fiocco a ali di farfalla, in velluto rosso: ali grandi in alto, più piccole in basso. */
function VelvetBow() {
  const id = useId().replace(/:/g, '')
  const wing = `${id}-wing`
  const lower = `${id}-lower`
  const knot = `${id}-knot`
  const tail = `${id}-tail`
  const velvet = `${id}-velvet`
  const soft = `${id}-soft`

  const left = (
    <>
      <path
        d="M70 36 C56 40 38 46 30 57 C24 65 33 73 43 68 C55 62 64 49 70 38 Z"
        fill={`url(#${lower})`}
        stroke="#4A0410"
        strokeWidth="0.8"
      />
      <path
        d="M70 34 C60 22 46 3 27 5 C9 7 4 24 13 34 C20 42 41 42 70 36 Z"
        fill={`url(#${wing})`}
        stroke="#4A0410"
        strokeWidth="0.8"
      />
      {/* pieghe del velluto e riflesso sul bordo */}
      <g filter={`url(#${soft})`} fill="none" strokeLinecap="round">
        <path d="M68 34 C57 28 42 19 28 16" stroke="#4A0410" strokeWidth="2.4" strokeOpacity="0.7" />
        <path d="M68 35.5 C55 35 38 33 20 28" stroke="#4A0410" strokeWidth="2" strokeOpacity="0.55" />
        <path d="M68 38 C59 45 47 54 38 62" stroke="#4A0410" strokeWidth="1.8" strokeOpacity="0.55" />
        <path d="M16 13 C24 6 38 6 50 15" stroke="#FF8A9A" strokeWidth="2.2" strokeOpacity="0.45" />
        <path d="M31 58 C35 52 44 47 52 45" stroke="#FF8A9A" strokeWidth="1.6" strokeOpacity="0.3" />
      </g>
    </>
  )

  return (
    <svg className="ss-garland-bow" width="60" height="39" viewBox="0 0 140 90">
      <defs>
        <radialGradient id={wing} cx="0.35" cy="0.35" r="0.75">
          <stop offset="0" stopColor="#E23A54" />
          <stop offset="0.45" stopColor="#B5112C" />
          <stop offset="1" stopColor="#6E0717" />
        </radialGradient>
        <radialGradient id={lower} cx="0.4" cy="0.4" r="0.8">
          <stop offset="0" stopColor="#C61A36" />
          <stop offset="1" stopColor="#5E0612" />
        </radialGradient>
        <linearGradient id={tail} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#8E0A20" />
          <stop offset="0.5" stopColor="#B5112C" />
          <stop offset="1" stopColor="#7A0819" />
        </linearGradient>
        <radialGradient id={knot} cx="0.4" cy="0.35" r="0.7">
          <stop offset="0" stopColor="#E8495F" />
          <stop offset="0.6" stopColor="#A50E28" />
          <stop offset="1" stopColor="#5E0612" />
        </radialGradient>
        {/* grana del velluto: rumore fine moltiplicato sul colore */}
        <filter id={velvet} x="-5%" y="-5%" width="110%" height="110%">
          <feTurbulence type="fractalNoise" baseFrequency="2.2" numOctaves="2" seed="7" result="noise" />
          <feColorMatrix
            in="noise"
            type="matrix"
            values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.6 0"
            result="grain"
          />
          <feComposite in="grain" in2="SourceGraphic" operator="in" result="grainIn" />
          <feBlend in="SourceGraphic" in2="grainIn" mode="multiply" />
        </filter>
        <filter id={soft} x="-10%" y="-10%" width="120%" height="120%">
          <feGaussianBlur stdDeviation="1.1" />
        </filter>
      </defs>

      <g filter={`url(#${velvet})`}>
        {/* code con il taglio a coda di rondine */}
        <path d="M66 40 C62 54 55 70 48 87 L56 81 L60 89 C65 72 69 56 72 42 Z" fill={`url(#${tail})`} />
        <path d="M74 40 C78 54 85 70 92 87 L84 81 L80 89 C75 72 71 56 68 42 Z" fill={`url(#${tail})`} />
        {left}
        <g transform="translate(140 0) scale(-1 1)">{left}</g>
        <path
          d="M61 27 C66 23.5 74 23.5 79 27 C81.5 32 81.5 39 79 44 C74 47.5 66 47.5 61 44 C58.5 39 58.5 32 61 27 Z"
          fill={`url(#${knot})`}
        />
        <g filter={`url(#${soft})`} fill="none" strokeLinecap="round">
          <path d="M64 30 C66 35 66 39 64 43" stroke="#4A0410" strokeWidth="1.4" strokeOpacity="0.6" />
          <path d="M76 30 C74 35 74 39 76 43" stroke="#4A0410" strokeWidth="1.4" strokeOpacity="0.6" />
          <path d="M65 27.5 C68 26 72 26 75 27.5" stroke="#FF9AA8" strokeWidth="1.6" strokeOpacity="0.5" />
        </g>
      </g>
    </svg>
  )
}

/** Il bordo della barra in alto: ghirlanda di pino e pungitopo, con un fiocco di velluto. */
export function Garland() {
  const back = useMemo(() => pineNeedles(11, PINE_BACK, 7, 34), [])
  const front = useMemo(() => pineNeedles(29, PINE_FRONT, 5.5, 30), [])
  const patternId = useId().replace(/:/g, '')

  return (
    <div className="ss-garland" aria-hidden>
      <svg width="100%" height={HEIGHT} className="d-block">
        <defs>
          <pattern id={patternId} width={TILE} height={HEIGHT} patternUnits="userSpaceOnUse">
            <g strokeWidth="1.2" strokeLinecap="round">
              {back.map((n, i) => (
                <path key={`b${i}`} d={n.d} stroke={n.color} />
              ))}
            </g>
            <path
              d={`M0 ${BRANCH_Y} C${TILE / 4} ${BRANCH_Y + 1.5} ${(TILE * 3) / 4} ${BRANCH_Y - 1.5} ${TILE} ${BRANCH_Y}`}
              stroke="#4A3423"
              strokeWidth="1.6"
              fill="none"
            />
            <g strokeWidth="1.1" strokeLinecap="round">
              {front.map((n, i) => (
                <path key={`f${i}`} d={n.d} stroke={n.color} />
              ))}
            </g>
            <Ruscus x={TILE / 2 - 4} y={BRANCH_Y + 1} />
            <Ruscus x={6} y={BRANCH_Y - 1} flip />
            <Ruscus x={TILE + 6} y={BRANCH_Y - 1} flip />
          </pattern>
        </defs>
        <rect width="100%" height={HEIGHT} fill={`url(#${patternId})`} />
      </svg>
      <VelvetBow />
    </div>
  )
}
