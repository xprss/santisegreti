import { useLayoutEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { errorMessage } from '../api/client'
import { useTakeTicket } from '../api/hooks'
import type { Lottery, Me, RoomDetail } from '../api/types'
import { Gingerbread } from '../components/Gingerbread'
import { accessoryLabel } from '../accessories/catalog'
import { plural } from '../lib/format'
import { prefersReducedMotion } from '../lib/motion'
import { LotteryTicket, StampInkFilter, TicketStamp } from './LotteryTicket'

interface LotterySectionProps {
  room: RoomDetail
  me: Me
  lottery: Lottery | null | undefined
}

/**
 * Prendere il biglietto: `printing` mentre il server lo stampa, `flying` mentre esce da sotto il
 * box (passando sopra le polaroid) e poi cade al suo posto come un foglio, `done` alla fine.
 */
type Step = 'idle' | 'printing' | 'flying' | 'done'

const EMERGE_MS = 1000
const FALL_MS = 1500

/**
 * Il volo del biglietto, misurato sulla pagina: esce da sotto il box a scatti (come da una
 * stampante) sopra le polaroid senza spostarle, poi si posa dove c'era il box ondeggiando come
 * un foglio di carta che cade, mentre la sua ombra sfuma.
 *
 * Si animano solo transform e opacity, che il telefono fa sulla GPU senza ridisegnare niente:
 * l'ombra è un livello a parte già sfocato (animare un `filter` ridisegnerebbe a ogni
 * fotogramma tutto il biglietto, timbro compreso, e su mobile scatta).
 */
async function flyTicket(box: HTMLElement, clip: HTMLElement, flyer: HTMLElement, shadow: HTMLElement) {
  const boxH = box.offsetHeight
  const ticketH = flyer.offsetHeight
  // Parte nascosto dietro al box (il bordo di sotto allineato al suo); sopra il box è tagliato.
  const hidden = boxH - ticketH
  const out = boxH + 12

  const emerge = { duration: EMERGE_MS, easing: 'steps(10, jump-end)', fill: 'forwards' } as const
  shadow.animate(
    [
      { opacity: 0, transform: 'translateY(0) scale(0.96)' },
      { opacity: 0.55, transform: 'translateY(1.1rem) scale(1)' },
    ],
    emerge,
  )
  await flyer.animate(
    [{ transform: `translateY(${hidden}px)` }, { transform: `translateY(${out}px)` }],
    emerge,
  ).finished

  // Fuori del tutto: da qui può salire sopra al box senza tagli.
  clip.classList.add('is-free')
  box.animate([{ opacity: 1 }, { opacity: 0, transform: 'scale(0.97)' }], {
    duration: 450,
    easing: 'ease-out',
    fill: 'forwards',
  })
  const fall = { duration: FALL_MS, easing: 'ease-in-out', fill: 'forwards' } as const
  // Più il foglio è alto, più l'ombra è lontana e chiara; posandosi sparisce.
  shadow.animate(
    [
      { offset: 0, opacity: 0.55, transform: 'translateY(1.1rem) scale(1)' },
      { offset: 0.14, opacity: 0.5, transform: 'translateY(2rem) scale(1.04)' },
      { offset: 0.36, opacity: 0.48, transform: 'translateY(1.9rem) scale(1.03)' },
      { offset: 0.57, opacity: 0.42, transform: 'translateY(1.3rem) scale(1.02)' },
      { offset: 0.76, opacity: 0.28, transform: 'translateY(0.7rem) scale(1)' },
      { offset: 0.9, opacity: 0.12, transform: 'translateY(0.25rem) scale(0.99)' },
      { offset: 1, opacity: 0, transform: 'translateY(0) scale(0.98)' },
    ],
    fall,
  )
  // Il foglio si solleva, poi scende ondeggiando di qua e di là, sempre meno, fino a posarsi.
  await flyer.animate(
    [
      { offset: 0, transform: `translate(0, ${out}px) rotate(0deg) scale(1)` },
      { offset: 0.14, transform: `translate(4px, ${out * 0.8}px) rotate(-4deg) scale(1.12)` },
      { offset: 0.36, transform: `translate(-22px, ${out * 0.48}px) rotate(8deg) scale(1.09)` },
      { offset: 0.57, transform: `translate(16px, ${out * 0.22}px) rotate(-5.5deg) scale(1.06)` },
      { offset: 0.76, transform: `translate(-8px, ${out * 0.07}px) rotate(3deg) scale(1.03)` },
      { offset: 0.9, transform: 'translate(3px, 0) rotate(-1deg) scale(1.01)' },
      { offset: 1, transform: 'translate(0, 0) rotate(0deg) scale(1)' },
    ],
    fall,
  ).finished
}

/** La lotteria della stanza, sopra le polaroid: invito, biglietto, poi il risultato. */
export function LotterySection({ room, me, lottery }: LotterySectionProps) {
  const take = useTakeTicket(room.id)
  const [step, setStep] = useState<Step>('idle')
  const box = useRef<HTMLDivElement>(null)
  const clip = useRef<HTMLDivElement>(null)
  const flyer = useRef<HTMLDivElement>(null)
  const shadow = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    if (step !== 'flying') return
    const [bx, cl, fl, sh] = [box.current, clip.current, flyer.current, shadow.current]
    if (!bx || !cl || !fl || !sh || typeof fl.animate !== 'function') {
      setStep('done')
      return
    }
    let cancelled = false
    flyTicket(bx, cl, fl, sh).then(
      () => !cancelled && setStep('done'),
      () => !cancelled && setStep('done'),
    )
    return () => {
      cancelled = true
    }
  }, [step])

  if (!lottery) return null

  if (lottery.status === 'draft') {
    // La bozza arriva solo all'admin: gli altri non sanno ancora niente.
    return (
      <section className="ss-pixel-box ss-lottery-note" aria-label="Lotteria in bozza">
        <p className="mb-0">
          La lotteria è pronta ma ancora chiusa: la apri da{' '}
          <Link to={`/stanze/${room.id}/gestisci`}>Gestisci la stanza</Link>.
        </p>
      </section>
    )
  }

  const ticket = lottery.my_ticket
  const animating = step === 'printing' || step === 'flying'

  const takeTicket = () => {
    setStep('printing')
    take.mutate(undefined, {
      onSuccess: () => setStep(prefersReducedMotion() ? 'done' : 'flying'),
      onError: () => setStep('idle'),
    })
  }

  const invite = (
    <div className="ss-pixel-box ss-lottery-invite">
      <i className="bi bi-gift-fill ss-lottery-invite-gift" aria-hidden />
      <div className="ss-lottery-invite-body">
        <p className="ss-pixel-text text-center mb-3">Partecipa alla Lotteria di Natale!</p>
        <button
          type="button"
          className="ss-pixel-button"
          onClick={takeTicket}
          disabled={step !== 'idle'}
        >
          <span aria-hidden>▶</span>
          {step === 'idle' ? 'PRENDI UN BIGLIETTO' : 'STAMPA IN CORSO…'}
        </button>
        {take.isError && (
          <p className="ss-pixel-small text-danger text-center mt-2 mb-0">
            {errorMessage(take.error)}
          </p>
        )}
      </div>
    </div>
  )

  return (
    <section className="ss-lottery" aria-labelledby="lottery-title">
      <StampInkFilter />
      <h2 id="lottery-title" className="visually-hidden">
        Lotteria della stanza
      </h2>

      {lottery.status === 'drawn' && lottery.winner ? (
        <LotteryResult lottery={lottery} me={me} />
      ) : ticket ? (
        animating ? (
          // Il box resta dov'è; il biglietto vola sopra la pagina e alla fine ne prende il posto.
          <div className="ss-lottery-stage">
            <div ref={box} className="ss-lottery-stage-box" aria-hidden>
              {invite}
            </div>
            <div ref={clip} className="ss-lottery-stage-clip">
              <div ref={flyer} className={`ss-lottery-flyer${step === 'printing' ? ' invisible' : ''}`}>
                <div ref={shadow} className="ss-lottery-flyer-shadow" />
                <LotteryTicket number={ticket.number} />
              </div>
            </div>
          </div>
        ) : (
          <LotteryTicket number={ticket.number} fresh={step === 'done'} />
        )
      ) : lottery.status === 'open' ? (
        invite
      ) : (
        <p className="ss-pixel-box ss-lottery-note mb-0">
          Estrazione in corso: {plural(lottery.ticket_count, 'biglietto', 'biglietti')} nell'urna.
        </p>
      )}
    </section>
  )
}

/** Il risultato per tutti: chi ha vinto, con il numero timbrato. Per chi ha vinto, la festa. */
function LotteryResult({ lottery, me }: { lottery: Lottery; me: Me }) {
  const winner = lottery.winner!
  const mine = winner.user.id === me.id
  const prize = accessoryLabel(lottery.prize).toLowerCase()

  return (
    <div className={`ss-lottery-result${mine ? ' is-mine' : ''}`}>
      <div className="ss-lottery-result-omino">
        <Gingerbread color={winner.user.color} accessory={lottery.prize} size={104} />
      </div>
      <div className="ss-lottery-result-body">
        <p className="ss-pixel-small mb-1">{mine ? 'HAI VINTO TU!' : 'LA LOTTERIA È STATA VINTA DA'}</p>
        <h3 className="ss-lottery-result-name">{mine ? `${winner.user.name}!` : winner.user.name}</h3>
        <TicketStamp number={winner.number} className="ss-stamp--small" />
        <p className="mt-2 mb-0">
          {mine ? (
            <>
              La {prize} è tua, e ce l'hai già addosso! Se vuoi cambiarla, vai al{' '}
              <Link to="/profilo">profilo</Link>.
            </>
          ) : (
            <>
              Vince la {prize}.{' '}
              {lottery.my_ticket
                ? `Il tuo biglietto era ${lottery.my_ticket.number}: sarà per la prossima!`
                : ''}
            </>
          )}
        </p>
      </div>
    </div>
  )
}
