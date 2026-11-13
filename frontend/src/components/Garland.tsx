import { useId, useMemo } from 'react'
import { seeded } from '../scene/random'

const TILE = 56
const HEIGHT = 24
const ROPE_Y = 10
const GOLDS = ['#E0B53A', '#F6CD4C', '#C9A227', '#FFE08A', '#B8901F']

/** Un tratto di boa: fili d'oro fitti, un rametto di agrifoglio e tre bacche. Si ripete. */
function useTile() {
  return useMemo(() => {
    const rand = seeded(2512)
    const strands = Array.from({ length: 44 }, (_, i) => {
      const x = (i / 44) * TILE + rand() * 1.2
      const half = 4.5 + rand() * 3.5
      const tilt = (rand() - 0.5) * 6
      return {
        d: `M${x - tilt / 2} ${ROPE_Y - half} L${x + tilt / 2} ${ROPE_Y + half}`,
        color: GOLDS[Math.floor(rand() * GOLDS.length)],
      }
    })
    return strands
  }, [])
}

/** Il bordo della barra in alto: un boa dorato con agrifoglio, bacche e un grande fiocco rosso. */
export function Garland() {
  const strands = useTile()
  const patternId = useId()

  return (
    <div className="ss-garland" aria-hidden>
      <svg width="100%" height={HEIGHT} className="d-block">
        <defs>
          <pattern id={patternId} width={TILE} height={HEIGHT} patternUnits="userSpaceOnUse">
            <rect y={ROPE_Y - 2.5} width={TILE} height="5" rx="2.5" fill="#B8901F" />
            <g strokeWidth="1.3" strokeLinecap="round">
              {strands.map((s, i) => (
                <path key={i} d={s.d} stroke={s.color} />
              ))}
            </g>
            {/* agrifoglio */}
            <g transform={`translate(${TILE / 2} ${ROPE_Y + 1})`}>
              <ellipse cx="-6" cy="0" rx="7" ry="3.2" transform="rotate(-25 -6 0)" fill="#1E8449" />
              <ellipse cx="6" cy="0" rx="7" ry="3.2" transform="rotate(25 6 0)" fill="#17693A" />
              <path d="M-11 2.5 L-1 -1 M11 2.5 L1 -1" stroke="#0F4A28" strokeWidth="0.8" />
              <circle cx="-2.4" cy="2" r="2.5" fill="#C8102E" />
              <circle cx="2.4" cy="2" r="2.5" fill="#C8102E" />
              <circle cx="0" cy="5.4" r="2.5" fill="#A80D26" />
              <circle cx="-3.1" cy="1.2" r="0.7" fill="#FFFFFF" opacity="0.7" />
              <circle cx="1.7" cy="1.2" r="0.7" fill="#FFFFFF" opacity="0.7" />
            </g>
          </pattern>
        </defs>
        <rect width="100%" height={HEIGHT} fill={`url(#${patternId})`} />
      </svg>

      <svg className="ss-garland-bow" width="80" height="56" viewBox="0 0 80 56">
        <path d="M37 18 L25 46 L30.5 43 L33.5 50.5 L41 20 Z" fill="#A80D26" />
        <path d="M43 18 L55 46 L49.5 43 L46.5 50.5 L39 20 Z" fill="#A80D26" />
        <path
          d="M40 14 C30 2 10 0 8 10 C6 20 26 24 40 16 Z"
          fill="#C8102E"
          stroke="#8E0A20"
          strokeWidth="1.2"
        />
        <path
          d="M40 14 C50 2 70 0 72 10 C74 20 54 24 40 16 Z"
          fill="#C8102E"
          stroke="#8E0A20"
          strokeWidth="1.2"
        />
        <path d="M38 14 C31 8 19 6 14 10 M42 14 C49 8 61 6 66 10" stroke="#8E0A20" strokeWidth="1.2" fill="none" strokeLinecap="round" />
        <path d="M14 7 C18 4 24 4 28 6" stroke="#FFFFFF" strokeOpacity="0.45" strokeWidth="1.6" fill="none" strokeLinecap="round" />
        <ellipse cx="40" cy="15.5" rx="6" ry="6.5" fill="#B00D27" stroke="#8E0A20" strokeWidth="1.2" />
        <path d="M37.5 12.5 C39 11.5 41 11.5 42.5 12.5" stroke="#FFFFFF" strokeOpacity="0.5" strokeWidth="1.2" fill="none" strokeLinecap="round" />
      </svg>
    </div>
  )
}
