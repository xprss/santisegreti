import { ACCESSORY_BY_ID, type AccessoryId, type AccessoryPart } from '../accessories/catalog'
import { shade } from '../lib/format'

/** Sagoma condivisa con la scena 3D (stesse proporzioni, unità 0–100 × 0–120). */
export const GINGERBREAD_PATH =
  'M50 6a19 19 0 0 1 13 32.8L82 43c9 2 10 15 0 17l-16-1 2 19 12 22c4 8-6 15-12 9L54 92h-8l-14 17c-6 6-16-1-12-9l12-22 2-19-16 1c-10-2-9-15 0-17l19-4.2A19 19 0 0 1 50 6z'

interface GingerbreadProps {
  color: string
  accessory?: AccessoryId | null
  size?: number
  title?: string
  className?: string
}

function Part({ part }: { part: AccessoryPart }) {
  if (part.kind === 'stroke') {
    return (
      <path
        d={part.d}
        fill="none"
        stroke={part.color}
        strokeWidth={part.width ?? 2}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={part.opacity}
      />
    )
  }
  return (
    <path
      d={part.d}
      fill={part.color}
      fillOpacity={part.opacity}
      stroke={part.opacity ? 'none' : shade(part.color, 0.35)}
      strokeWidth="1.2"
      strokeLinejoin="round"
    />
  )
}

/**
 * L'omino di pan di zenzero, con l'eventuale accessorio. I cappelli escono dal riquadro verso
 * l'alto (overflow visibile), così tutti gli omini hanno la stessa misura con o senza accessorio.
 */
export function Gingerbread({ color, accessory, size = 48, title, className }: GingerbreadProps) {
  const outline = shade(color, 0.3)
  const parts = (accessory && ACCESSORY_BY_ID.get(accessory)?.parts) || []
  const behind = parts.filter((p) => p.layer === 'back')
  const over = parts.filter((p) => p.layer !== 'back')

  return (
    <svg
      width={size}
      height={(size * 120) / 100}
      viewBox="0 0 100 120"
      overflow="visible"
      className={className}
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      {behind.map((part, i) => (
        <Part key={`b${i}`} part={part} />
      ))}
      <path d={GINGERBREAD_PATH} fill={color} stroke={outline} strokeWidth="3" />
      {/* glassa */}
      <g fill="none" stroke="#FFFDF8" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 47l3 4-3 4 3 4" />
        <path d="M83 47l-3 4 3 4-3 4" />
        <path d="M24 99l4 3 4-3 4 3" />
        <path d="M64 99l4 3 4-3 4 3" />
        <path d="M42 31q8 6 16 0" />
      </g>
      <circle cx="43" cy="22" r="3.2" fill="#3B2A20" />
      <circle cx="57" cy="22" r="3.2" fill="#3B2A20" />
      <circle cx="50" cy="52" r="3.6" fill="#FFFDF8" />
      <circle cx="50" cy="64" r="3.6" fill="#FFFDF8" />
      <circle cx="50" cy="76" r="3.6" fill="#FFFDF8" />
      {over.map((part, i) => (
        <Part key={`o${i}`} part={part} />
      ))}
    </svg>
  )
}
