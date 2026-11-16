import { useRef, useState } from 'react'
import { Link } from 'react-router'
import type { Lottery, Me, RoomDetail } from '../api/types'
import { Gingerbread } from '../components/Gingerbread'
import { accessoryLabel } from '../accessories/catalog'
import { plural } from '../lib/format'
import { LotteryTicket, StampInkFilter, TicketStamp } from './LotteryTicket'
import { TicketTear } from './TicketTear'

interface LotterySectionProps {
  room: RoomDetail
  me: Me
  lottery: Lottery | null | undefined
}

function torn(count: number) {
  return count === 1 ? '1 biglietto strappato' : `${count} biglietti strappati`
}

/** La lotteria della stanza, sopra le polaroid: invito, biglietto, poi il risultato. */
export function LotterySection({ room, me, lottery }: LotterySectionProps) {
  const [tearing, setTearing] = useState(false)
  const [fresh, setFresh] = useState(false)
  const ticketRef = useRef<HTMLElement>(null)

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

  return (
    <section className="ss-lottery" aria-labelledby="lottery-title">
      <StampInkFilter />
      <h2 id="lottery-title" className="visually-hidden">
        Lotteria della stanza
      </h2>

      {lottery.status === 'drawn' && lottery.winner ? (
        <LotteryResult lottery={lottery} me={me} />
      ) : ticket ? (
        <>
          <LotteryTicket
            ref={ticketRef}
            number={ticket.number}
            fresh={fresh}
            waiting={tearing}
          />
          <p className="ss-lottery-caption">
            {torn(lottery.ticket_count)} ·{' '}
            {lottery.status === 'countdown'
              ? 'estrazione in corso!'
              : "l'estrazione sarà in diretta, quando la lancia l'admin"}
          </p>
        </>
      ) : lottery.status === 'open' ? (
        <div className="ss-pixel-box ss-lottery-invite">
          <i className="bi bi-gift-fill ss-lottery-invite-gift" aria-hidden />
          <div className="ss-lottery-invite-body">
            <p className="ss-pixel-text mb-2">
              Partecipa alla Lotteria di Natale!!!
            </p>
            <p className="ss-pixel-small mb-3">
              {lottery.ticket_count > 0 ? torn(lottery.ticket_count) : 'Nessun biglietto, per ora'}
            </p>
            <button type="button" className="ss-pixel-button" onClick={() => setTearing(true)}>
              <span aria-hidden>▶ </span>PRENDI UN BIGLIETTO
            </button>
          </div>
        </div>
      ) : (
        <p className="ss-pixel-box ss-lottery-note mb-0">
          Estrazione in corso: {plural(lottery.ticket_count, 'biglietto', 'biglietti')} nell'urna.
        </p>
      )}

      {tearing && (
        <TicketTear
          roomId={room.id}
          target={ticketRef}
          onClose={() => setTearing(false)}
          onLanded={() => setFresh(true)}
        />
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
