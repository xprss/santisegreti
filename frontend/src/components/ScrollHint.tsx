/** In fondo alla scena a tutto schermo: sfumatura nera, una scritta e la chevron che saltella. */
export function ScrollHint({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" className="ss-scene-scroll" onClick={onClick}>
      <span>{label}</span>
      <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden>
        <path
          d="M5 9l7 7 7-7"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  )
}
