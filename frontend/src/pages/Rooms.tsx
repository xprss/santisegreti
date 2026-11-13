import type { CSSProperties } from 'react'
import { Container } from 'react-bootstrap'
import { Link } from 'react-router'
import { useRooms } from '../api/hooks'
import type { RoomSummary } from '../api/types'
import { ErrorAlert, Loading } from '../components/feedback'
import { Logo } from '../components/Logo'
import { daysUntil, formatEuro, parseDay, plural } from '../lib/format'

const TILTS = [-1.5, 1.2, -0.8, 1.6, -1.2]
const MONTHS = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic']

function countdown(isoDay: string): string {
  const days = daysUntil(isoDay)
  if (days > 1) return `tra ${days} giorni`
  if (days === 1) return 'domani!'
  if (days === 0) return 'oggi!'
  return 'già passato'
}

/** Le tue stanze, nello stile della stanza: due bigliettini-azione e un bigliettino per stanza. */
export function Rooms() {
  const rooms = useRooms()

  return (
    <Container className="ss-page ss-narrow">
      <h1 className="visually-hidden">Le tue stanze</h1>

      <div className="ss-home-actions">
        <Link
          to="/stanze/nuova"
          className="ss-sticker ss-sticker--red ss-home-action"
          style={{ '--tilt': '-2deg' } as CSSProperties}
        >
          <span className="ss-home-action-icon" aria-hidden>
            +
          </span>
          <span className="ss-home-action-label">Apri una stanza</span>
        </Link>
        <Link
          to="/unisciti"
          className="ss-sticker ss-sticker--gold ss-home-action"
          style={{ '--tilt': '1.8deg' } as CSSProperties}
        >
          <span className="ss-home-action-code" aria-hidden>
            ABC234
          </span>
          <span className="ss-home-action-label">Ho un codice</span>
        </Link>
      </div>

      {rooms.isPending && <Loading />}
      <ErrorAlert error={rooms.error} />

      {rooms.data?.length === 0 && (
        <div className="ss-sticker text-center" style={{ '--tilt': '1deg' } as CSSProperties}>
          <Logo size={64} className="mb-2" />
          <p className="ss-sticker-caption mb-1">Ancora nessuna stanza</p>
          <p className="mb-0">Ne apriamo una? O, se ti hanno mandato un codice, si entra da lì.</p>
        </div>
      )}

      <div className="ss-stickers">
        {rooms.data?.map((room, i) => (
          <RoomSticker key={room.id} room={room} tilt={TILTS[i % TILTS.length]} />
        ))}
      </div>
    </Container>
  )
}

function RoomSticker({ room, tilt }: { room: RoomSummary; tilt: number }) {
  const date = room.exchange_date ? parseDay(room.exchange_date) : null

  return (
    <article
      className="ss-sticker ss-room-sticker"
      style={{ '--tilt': `${tilt}deg` } as CSSProperties}
    >
      <h2 className="ss-room-sticker-name">
        <Link to={`/stanze/${room.id}`} className="stretched-link">
          {room.name}
        </Link>
      </h2>
      {room.theme && <p className="ss-room-sticker-theme">“{room.theme}”</p>}

      <div className="ss-room-sticker-facts">
        <span className="ss-fact">
          <strong>{room.participant_count}</strong>
          {room.participant_count === 1 ? 'persona' : 'persone'}
        </span>
        <span className="ss-fact ss-fact--gold">
          <strong>{formatEuro(room.budget_eur)}</strong>a regalo
        </span>
        {date && room.exchange_date && (
          <span className="ss-fact ss-fact--red">
            <strong>
              {date.getDate()} {MONTHS[date.getMonth()]}
            </strong>
            {countdown(room.exchange_date)}
          </span>
        )}
        {room.status === 'drawn' && <span className="ss-stamp">Estrazione fatta</span>}
      </div>
      {room.is_admin && (
        <span className="ss-room-sticker-admin" title="Sei l'admin di questa stanza">
          admin
        </span>
      )}
      <span className="visually-hidden">
        {plural(room.participant_count, 'persona', 'persone')}
      </span>
    </article>
  )
}
