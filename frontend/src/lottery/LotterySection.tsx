import { useEffect, useState } from 'react'
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
 * Prendere il biglietto: `printing` mentre il server lo stampa, `emerging` mentre esce da sotto
 * il box come da una fessura, `replacing` mentre sale e prende il posto del box, `done` alla fine.
 */
type Step = 'idle' | 'printing' | 'emerging' | 'replacing' | 'done'

const EMERGE_MS = 1000
const REPLACE_MS = 650

/** La lotteria della stanza, sopra le polaroid: invito, biglietto, poi il risultato. */
export function LotterySection({ room, me, lottery }: LotterySectionProps) {
  const take = useTakeTicket(room.id)
  const [step, setStep] = useState<Step>('idle')

  useEffect(() => {
    if (step !== 'emerging' && step !== 'replacing') return
    const next = step === 'emerging' ? 'replacing' : 'done'
    const timer = window.setTimeout(() => setStep(next), step === 'emerging' ? EMERGE_MS : REPLACE_MS)
    return () => window.clearTimeout(timer)
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
  const animating = step === 'printing' || step === 'emerging' || step === 'replacing'

  const takeTicket = () => {
    setStep('printing')
    take.mutate(undefined, {
      onSuccess: () => setStep(prefersReducedMotion() ? 'done' : 'emerging'),
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
        // Il biglietto esce da sotto il box, poi il box si ritira e lui sale al suo posto.
        <div className={`ss-lottery-print is-${step}`}>
          {animating && (
            <div className="ss-lottery-print-box" aria-hidden>
              <div>{invite}</div>
            </div>
          )}
          <div className="ss-lottery-print-slot">
            <div>
              <LotteryTicket number={ticket.number} fresh={step === 'done'} />
            </div>
          </div>
        </div>
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
