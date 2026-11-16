import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { CloseButton } from 'react-bootstrap'
import { accessoryLabel } from '../accessories/catalog'
import { keys } from '../api/hooks'
import type { Lottery, Me } from '../api/types'
import { Gingerbread } from '../components/Gingerbread'
import { prefersReducedMotion } from '../lib/motion'
import { StampInkFilter } from './LotteryTicket'

/** Numeri pseudo-casuali ma stabili: i glitter non saltano a ogni render. */
const rand = (i: number, n: number) => ((Math.sin(i * 12.9898 + n * 78.233) * 43758.5453) % 1 + 1) % 1
const SPARKLE_COLORS = ['#ffd54f', '#fff6d5', '#ffffff', '#ff6b6b', '#7ee081', '#ffe08a']

/** Glitter fermi che brillano su tutto lo schermo. */
const GLITTER: CSSProperties[] = Array.from({ length: 70 }, (_, i) => ({
  left: `${(rand(i, 1) * 100).toFixed(1)}%`,
  top: `${(rand(i, 2) * 100).toFixed(1)}%`,
  '--s': `${(0.45 + rand(i, 3) * 0.9).toFixed(2)}rem`,
  '--d': `${(rand(i, 4) * 2).toFixed(2)}s`,
  '--t': `${(0.8 + rand(i, 5) * 1.4).toFixed(2)}s`,
  '--c': SPARKLE_COLORS[i % SPARKLE_COLORS.length],
}) as CSSProperties)

/** Coriandoli lucidi che piovono dall'alto, senza fine. */
const CONFETTI: CSSProperties[] = Array.from({ length: 44 }, (_, i) => ({
  left: `${(rand(i, 6) * 100).toFixed(1)}%`,
  '--d': `${(rand(i, 7) * 4).toFixed(2)}s`,
  '--t': `${(2.8 + rand(i, 8) * 2.6).toFixed(2)}s`,
  '--x': `${((rand(i, 9) - 0.5) * 8).toFixed(1)}rem`,
  '--r': `${Math.round(360 + rand(i, 10) * 720)}deg`,
  '--c': SPARKLE_COLORS[(i + 2) % SPARKLE_COLORS.length],
}) as CSSProperties)

const REEL_STOP_MS = 320
const FALLBACK_MS = 3000
const DIGITS = 6

interface OverlayProps {
  roomId: string
  me: Me
  lottery: Lottery | null | undefined
  online: Set<string>
}

/**
 * L'estrazione in diretta, a tutto schermo per chiunque abbia la stanza aperta: conto alla
 * rovescia uguale per tutti (lo scandisce il server), rulli che girano e si fermano sul numero
 * vincente, poi l'omino che ha vinto con la sua tunica.
 */
export function LotteryCountdownOverlay({ roomId, me, lottery, online }: OverlayProps) {
  const client = useQueryClient()
  const [open, setOpen] = useState(false)
  const [revealed, setRevealed] = useState(false)
  const [ticking, setTicking] = useState<number | null>(null)
  const deadline = useRef<number | null>(null)
  const winner = lottery?.status === 'drawn' ? lottery.winner : null

  // Si apre a chi c'è (o arriva) durante il countdown. A rivelazione avvenuta resta aperto
  // finché non lo chiudi; chi apre la pagina dopo trova il risultato nella sezione.
  // (Stato aggiornato durante il render, come si fa con le prop precedenti.)
  const [synced, setSynced] = useState<Lottery | null | undefined>(null)
  if (lottery !== synced) {
    setSynced(lottery)
    if (lottery?.status === 'countdown') setOpen(true)
  }

  // Ogni stato nuovo dal server riallinea la scadenza: millisecondi residui, non orari assoluti.
  useEffect(() => {
    if (lottery?.status === 'countdown' && lottery.countdown_ms !== null) {
      deadline.current = performance.now() + lottery.countdown_ms
    }
  }, [lottery])

  useEffect(() => {
    if (!open || winner) return
    const timer = window.setInterval(() => {
      if (deadline.current === null) return
      setTicking(Math.max(0, Math.ceil((deadline.current - performance.now()) / 1000)))
    }, 100)
    return () => window.clearInterval(timer)
  }, [open, winner])

  const secondsLeft = ticking ?? Math.ceil((lottery?.countdown_ms ?? 0) / 1000)

  // Se il WebSocket è caduto proprio adesso, il risultato si va a prendere con la REST.
  useEffect(() => {
    if (!open || winner || secondsLeft > 0) return
    const timer = window.setTimeout(
      () => client.invalidateQueries({ queryKey: keys.lottery(roomId) }),
      FALLBACK_MS,
    )
    return () => window.clearTimeout(timer)
  }, [open, winner, secondsLeft, client, roomId])

  useEffect(() => {
    if (!open) return
    document.body.classList.add('ss-no-scroll')
    return () => document.body.classList.remove('ss-no-scroll')
  }, [open])

  if (!open || !lottery) return null

  const close = () => {
    setOpen(false)
    setRevealed(false)
  }
  const mine = winner?.user.id === me.id
  const live = online.size

  return createPortal(
    <div
      className={`ss-draw${revealed ? ' is-revealed' : ''}${mine ? ' is-mine' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-label="Estrazione della lotteria"
      onKeyDown={(e) => {
        if (e.key === 'Escape' && revealed) close()
      }}
    >
      <StampInkFilter />
      {revealed && (
        <CloseButton variant="white" className="ss-draw-close" aria-label="Chiudi" onClick={close} />
      )}

      <p className="ss-draw-live">
        <span className="ss-draw-live-dot" aria-hidden /> ESTRAZIONE IN DIRETTA
        {live > 0 && ` · ${live} ${live === 1 ? 'collegato' : 'collegati'}`}
      </p>

      {!revealed && (
        <div className="ss-draw-count" aria-hidden>
          <span key={winner ? 'go' : secondsLeft} className="ss-draw-count-number">
            {winner || secondsLeft === 0 ? '!!!' : secondsLeft}
          </span>
        </div>
      )}
      <p className="visually-hidden" aria-live="assertive">
        {winner
          ? `Ha vinto ${winner.user.name}, con il biglietto ${winner.number}.`
          : 'Estrazione in corso.'}
      </p>

      <Reels
        number={winner?.number ?? null}
        onStopped={() => window.setTimeout(() => setRevealed(true), 500)}
      />

      {revealed && winner && (
        <>
          {/* La gloria: fasci di luce a tutto schermo e glitter ovunque, dietro a tutto. */}
          <div className="ss-draw-glory" aria-hidden>
            <div className="ss-draw-beams" />
            <div className="ss-draw-halo" />
            {GLITTER.map((style, i) => (
              <span key={`g${i}`} className="ss-draw-glitter" style={style} />
            ))}
            {CONFETTI.map((style, i) => (
              <span key={`c${i}`} className="ss-draw-confetti" style={style} />
            ))}
          </div>
          <div className="ss-draw-reveal">
            <div className="ss-draw-omino">
              <Gingerbread
                color={winner.user.color}
                accessory={lottery.prize}
                size={150}
                className="ss-draw-omino-art"
              />
            </div>
            <div className="ss-draw-title">
              <p className="ss-draw-headline">{mine ? 'HAI VINTO TU!' : 'HA VINTO'}</p>
              <h2 className="ss-draw-name">{winner.user.name}</h2>
              <p className="ss-draw-prize">
                {mine ? (
                  <>
                    La {accessoryLabel(lottery.prize).toLowerCase()} è tua, e ce l'hai già
                    addosso!
                  </>
                ) : (
                  `si porta a casa la ${accessoryLabel(lottery.prize).toLowerCase()}`
                )}
              </p>
            </div>
            <div className="ss-reveal-burst" aria-hidden>
              {Array.from({ length: 14 }, (_, i) => (
                <span key={i} style={{ '--i': i } as CSSProperties} />
              ))}
            </div>
          </div>
        </>
      )}
    </div>,
    document.body,
  )
}

/**
 * SANTO- e sei rulli che girano finché non arriva il numero vincente; poi si fermano uno alla
 * volta, da sinistra, come una slot.
 */
function Reels({ number, onStopped }: { number: string | null; onStopped: () => void }) {
  const reduce = prefersReducedMotion()
  const [spin, setSpin] = useState(() => '000000')
  const [stopped, setStopped] = useState(0)
  const done = useRef(false)
  const notify = useRef(onStopped)
  useEffect(() => {
    notify.current = onStopped
  })
  const target = number?.replace(/\D/g, '').padStart(DIGITS, '0') ?? null

  useEffect(() => {
    if (reduce || stopped >= DIGITS) return
    const timer = window.setInterval(() => {
      setSpin(
        Array.from({ length: DIGITS }, () => Math.floor(Math.random() * 10)).join(''),
      )
    }, 70)
    return () => window.clearInterval(timer)
  }, [reduce, stopped])

  useEffect(() => {
    if (!target) return
    if (stopped >= DIGITS) {
      if (!done.current) {
        done.current = true
        notify.current()
      }
      return
    }
    const timer = window.setTimeout(() => setStopped((n) => n + 1), reduce ? 0 : REEL_STOP_MS)
    return () => window.clearTimeout(timer)
  }, [target, stopped, reduce])

  return (
    <div className="ss-draw-reels" aria-hidden>
      <span className="ss-draw-reels-prefix">SANTO-</span>
      {Array.from({ length: DIGITS }, (_, i) => {
        const settled = target !== null && i < stopped
        return (
          <span key={i} className={`ss-draw-reel${settled ? ' is-stopped' : ''}`}>
            {settled ? target[i] : reduce ? '?' : spin[i]}
          </span>
        )
      })}
    </div>
  )
}
