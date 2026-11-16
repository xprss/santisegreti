import { useEffect, useRef, useState, type CSSProperties, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { errorMessage } from '../api/client'
import { useTakeTicket } from '../api/hooks'
import { prefersReducedMotion } from '../lib/motion'
import { PixelDialog } from './PixelDialog'

type Step = 'ask' | 'printing' | 'tear' | 'fly' | 'error'

const PRINT_MS = 1100
const FLY_MS = 700

/** Il bigliettino in pixel art (40 × 18): matrice a sinistra, perforazione, righe e timbro. */
function PixelTicketArt() {
  const perforation = Array.from({ length: 8 }, (_, i) => (
    <rect key={i} x={11} y={1 + i * 2} width={1} height={1} fill="#2f5e8c" />
  ))
  return (
    <svg viewBox="0 0 40 18" shapeRendering="crispEdges" className="ss-pixel-ticket-art">
      {/* contorno con gli angoli "smussati" a pixel */}
      <rect x={1} y={0} width={38} height={18} fill="#2f5e8c" />
      <rect x={0} y={1} width={40} height={16} fill="#2f5e8c" />
      <rect x={1} y={1} width={38} height={16} fill="#bfe3f7" />
      <rect x={1} y={1} width={38} height={1} fill="#e6f5fd" />
      <rect x={1} y={1} width={1} height={15} fill="#e6f5fd" />
      <rect x={1} y={16} width={38} height={1} fill="#93c8ea" />
      {perforation}
      {/* stellina sulla matrice */}
      <rect x={5} y={6} width={2} height={6} fill="#f4b400" />
      <rect x={3} y={8} width={6} height={2} fill="#f4b400" />
      <rect x={4} y={7} width={4} height={4} fill="#ffd54f" />
      {/* scritte e timbro */}
      <rect x={14} y={3} width={18} height={2} fill="#4a7fae" />
      <rect x={14} y={6} width={11} height={1} fill="#7fb2d9" />
      <rect x={13} y={9} width={24} height={6} fill="#1d1b1a" />
      <rect x={14} y={10} width={22} height={4} fill="#bfe3f7" />
      {Array.from({ length: 6 }, (_, i) => (
        <rect key={i} x={16 + i * 3.4} y={11} width={2} height={2} fill="#1d1b1a" />
      ))}
    </svg>
  )
}

const CONFETTI = ['#f48fb1', '#ffd54f', '#b39ddb', '#ff7f6e', '#fbf8f3', '#7cb342']

interface TicketTearProps {
  roomId: string
  /** Dove atterra il biglietto vero (nella sezione della lotteria). */
  target: RefObject<HTMLElement | null>
  onClose: () => void
  onLanded: () => void
}

/**
 * Prendere il biglietto, come al banco della lotteria di un gioco di ruolo in pixel: il dialogo
 * chiede conferma, la macchinetta lo stampa, si strappa lungo la perforazione e il biglietto
 * vola al suo posto nella pagina.
 */
export function TicketTear({ roomId, target, onClose, onLanded }: TicketTearProps) {
  const take = useTakeTicket(roomId)
  const [step, setStep] = useState<Step>('ask')
  const [number, setNumber] = useState('')
  const [leaving, setLeaving] = useState(false)
  const flyer = useRef<HTMLDivElement>(null)
  const reduce = prefersReducedMotion()
  const timers = useRef<number[]>([])

  useEffect(() => {
    const pending = timers.current
    document.body.classList.add('ss-no-scroll')
    return () => {
      document.body.classList.remove('ss-no-scroll')
      pending.forEach((t) => window.clearTimeout(t))
    }
  }, [])

  const later = (fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms))
  }

  const finish = () => {
    onLanded()
    onClose()
  }

  const yes = () => {
    setStep('printing')
    const started = performance.now()
    take.mutate(undefined, {
      onSuccess: (lottery) => {
        setNumber(lottery?.my_ticket?.number ?? '')
        if (reduce) {
          finish()
          return
        }
        // Anche con un server velocissimo, la macchinetta si prende il suo tempo per stampare.
        later(() => setStep('tear'), Math.max(0, PRINT_MS - (performance.now() - started)))
      },
      onError: () => setStep('error'),
    })
  }

  const fly = () => {
    const from = flyer.current
    const to = target.current
    setStep('fly')
    setLeaving(true)
    if (!from || !to || typeof from.animate !== 'function') {
      later(finish, 250)
      return
    }
    to.scrollIntoView({ block: 'center', behavior: 'instant' })
    const a = from.getBoundingClientRect()
    const b = to.getBoundingClientRect()
    const dx = b.left + b.width / 2 - (a.left + a.width / 2)
    const dy = b.top + b.height / 2 - (a.top + a.height / 2)
    const scale = b.width / a.width
    from
      .animate(
        [
          { transform: 'translate(0, 0) rotate(6deg) scale(1)', opacity: 1 },
          { transform: `translate(${dx * 0.5}px, ${dy * 0.5 - 60}px) rotate(-8deg) scale(${(1 + scale) / 2})`, opacity: 1, offset: 0.55 },
          { transform: `translate(${dx}px, ${dy}px) rotate(0deg) scale(${scale})`, opacity: 0.2 },
        ],
        { duration: FLY_MS, easing: 'cubic-bezier(0.45, 0, 0.3, 1)', fill: 'forwards' },
      )
      .finished.then(finish, finish)
  }

  const text =
    step === 'ask'
      ? 'Vuoi tentare la fortuna alla lotteria della stanza? Il premio è una sorpresa!'
      : step === 'printing'
        ? 'Bzz… bzz… la macchinetta sta stampando il tuo biglietto…'
        : step === 'error'
          ? `Ahi! La macchinetta si è inceppata. ${errorMessage(take.error)}`
          : `Ecco il tuo biglietto: ${number}! Tienilo stretto, l’estrazione è in diretta.`

  return createPortal(
    <div
      className={`ss-tear${leaving ? ' is-leaving' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-label="Prendi un biglietto della lotteria"
      onKeyDown={(e) => {
        if (e.key === 'Escape' && (step === 'ask' || step === 'error')) onClose()
      }}
    >
      <div className="ss-tear-stage" data-step={step}>
        <div className="ss-tear-machine" aria-hidden>
          <span className="ss-tear-machine-sign">LOTTO</span>
          <span className="ss-tear-machine-light" />
          <span className="ss-tear-machine-slot" />
        </div>
        <div className="ss-tear-feed" aria-hidden>
          {step !== 'ask' && step !== 'error' && (
            <div className="ss-tear-ticket">
              <div className="ss-tear-half ss-tear-stub">
                <PixelTicketArt />
              </div>
              <div ref={flyer} className="ss-tear-half ss-tear-main">
                <PixelTicketArt />
              </div>
              {step === 'tear' && (
                <div className="ss-tear-confetti">
                  {Array.from({ length: 12 }, (_, i) => (
                    <span
                      key={i}
                      style={
                        {
                          '--a': `${i * 30 + 10}deg`,
                          '--c': CONFETTI[i % CONFETTI.length],
                          '--d': `${(i % 3) * 0.05}s`,
                        } as CSSProperties
                      }
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {step !== 'fly' && (
        <PixelDialog
          key={step}
          text={text}
          choices={
            step === 'ask'
              ? [
                  { label: 'SÌ', onSelect: yes },
                  { label: 'NO', onSelect: onClose },
                ]
              : undefined
          }
          onNext={step === 'error' ? onClose : step === 'tear' ? fly : undefined}
        />
      )}
    </div>,
    document.body,
  )
}
