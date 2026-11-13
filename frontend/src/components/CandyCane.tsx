/** Bastoncino di zucchero a strisce bianche e rosse: l'icona del menu. */
export function CandyCane({ size = 28 }: { size?: number }) {
  const d = 'M11 27 V11.5 a6.5 6.5 0 0 1 13 0 V13.5'
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      <path d={d} fill="none" stroke="#8E1B22" strokeWidth="6.6" strokeLinecap="round" />
      <path d={d} fill="none" stroke="#FFFDF8" strokeWidth="5" strokeLinecap="round" />
      <path
        d={d}
        fill="none"
        stroke="#D62B37"
        strokeWidth="5"
        strokeDasharray="2.6 2.6"
        strokeLinecap="butt"
      />
    </svg>
  )
}
