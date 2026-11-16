import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { prefersReducedMotion } from '../lib/motion'

const LETTER_MS = 26

export interface PixelChoice {
  label: string
  onSelect: () => void
}

interface PixelDialogProps {
  /** Per ricominciare a scrivere con un testo nuovo, il genitore cambia `key`. */
  text: string
  /** A testo finito: piccolo menu di scelta sopra il riquadro (Sì / No). */
  choices?: PixelChoice[]
  /** A testo finito: compare la freccina ▼ e un tocco va avanti. */
  onNext?: () => void
}

/**
 * Il riquadro di dialogo dei giochi di ruolo in pixel: doppio bordo, testo che compare lettera
 * per lettera (un tocco lo completa subito), freccina per andare avanti o menu di scelta.
 */
export function PixelDialog({ text, choices, onNext }: PixelDialogProps) {
  const [shown, setShown] = useState(() => (prefersReducedMotion() ? text.length : 0))
  const done = shown >= text.length

  useEffect(() => {
    if (done) return
    const timer = window.setTimeout(() => setShown((n) => n + 1), LETTER_MS)
    return () => window.clearTimeout(timer)
  }, [shown, done])

  const advance = () => {
    if (!done) setShown(text.length)
    else onNext?.()
  }

  return (
    <div className="ss-pixel-dialog-wrap">
      {done && choices && <PixelChoices choices={choices} />}
      <div
        className="ss-pixel-box ss-pixel-dialog"
        role={onNext && done ? 'button' : undefined}
        tabIndex={onNext && done ? 0 : undefined}
        onClick={advance}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            advance()
          }
        }}
      >
        <p className="visually-hidden" aria-live="polite">
          {text}
        </p>
        <p className="ss-pixel-text" aria-hidden>
          {text.slice(0, shown)}
          {/* Il resto del testo, invisibile: il riquadro non cambia altezza mentre si scrive. */}
          <span className="ss-pixel-ghost">{text.slice(shown)}</span>
        </p>
        {done && onNext && (
          <span className="ss-pixel-next" aria-hidden>
            ▼
          </span>
        )}
        {done && onNext && <span className="visually-hidden">Tocca per continuare</span>}
      </div>
    </div>
  )
}

/** Menu Sì/No con il cursore ▶: frecce e Invio da tastiera, oppure un tocco. */
function PixelChoices({ choices }: { choices: PixelChoice[] }) {
  const [active, setActive] = useState(0)
  const buttons = useRef<(HTMLButtonElement | null)[]>([])

  useEffect(() => {
    buttons.current[0]?.focus()
  }, [])

  const move = (event: KeyboardEvent, delta: number) => {
    event.preventDefault()
    const next = (active + delta + choices.length) % choices.length
    setActive(next)
    buttons.current[next]?.focus()
  }

  return (
    <div className="ss-pixel-box ss-pixel-choices" role="group" aria-label="Scegli">
      {choices.map((choice, i) => (
        <button
          key={choice.label}
          ref={(el) => {
            buttons.current[i] = el
          }}
          type="button"
          className={`ss-pixel-choice${i === active ? ' is-active' : ''}`}
          onFocus={() => setActive(i)}
          onMouseEnter={() => setActive(i)}
          onClick={choice.onSelect}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') move(e, 1)
            if (e.key === 'ArrowUp') move(e, -1)
          }}
        >
          <span className="ss-pixel-cursor" aria-hidden>
            ▶
          </span>
          {choice.label}
        </button>
      ))}
    </div>
  )
}
