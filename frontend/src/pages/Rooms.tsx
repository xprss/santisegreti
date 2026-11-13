import { Badge, Card, Container, Stack } from 'react-bootstrap'
import { Link } from 'react-router'
import { useRooms } from '../api/hooks'
import type { RoomSummary } from '../api/types'
import { ErrorAlert, Loading } from '../components/feedback'
import { Logo } from '../components/Logo'
import { exchangeCountdown, formatEuro, plural } from '../lib/format'

export function Rooms() {
  const rooms = useRooms()

  return (
    <Container className="ss-page ss-narrow">
      <h1 className="h2 mb-3">Le tue stanze</h1>

      <div className="ss-actions mb-4">
        <Link to="/stanze/nuova" className="btn btn-primary">
          Apri una stanza
        </Link>
        <Link to="/unisciti" className="btn btn-outline-secondary">
          Ho un codice di invito
        </Link>
      </div>

      {rooms.isPending && <Loading />}
      <ErrorAlert error={rooms.error} />

      {rooms.data?.length === 0 && (
        <Card className="text-center">
          <Card.Body className="py-5">
            <Logo size={56} className="mb-3 opacity-75" />
            <p className="mb-1 fw-semibold">Qui non c'è ancora nessuna stanza.</p>
            <p className="text-body-secondary mb-0">
              Ne apriamo una? Oppure, se qualcuno ti ha mandato un codice, si entra da "Ho un
              codice di invito".
            </p>
          </Card.Body>
        </Card>
      )}

      <Stack gap={3}>
        {rooms.data?.map((room) => (
          <RoomCard key={room.id} room={room} />
        ))}
      </Stack>
    </Container>
  )
}

function RoomCard({ room }: { room: RoomSummary }) {
  return (
    <Card className="ss-room-card position-relative">
      <Card.Body>
        <div className="d-flex justify-content-between align-items-start gap-2 mb-1">
          <h2 className="h5 mb-0">
            <Link to={`/stanze/${room.id}`} className="stretched-link text-reset text-decoration-none">
              {room.name}
            </Link>
          </h2>
          {room.status === 'drawn' && (
            <Badge bg="secondary" className="flex-shrink-0">
              Estrazione fatta
            </Badge>
          )}
        </div>
        <p className="text-body-secondary small mb-0">
          {plural(room.participant_count, 'persona', 'persone')} · fino a{' '}
          {formatEuro(room.budget_eur)}
          {room.is_admin && ' · sei l\'admin'}
        </p>
        {room.theme && <p className="mb-0 mt-2">Tema: {room.theme}</p>}
        {room.exchange_date && (
          <p className="mb-0 mt-2 small text-secondary fw-semibold">
            {exchangeCountdown(room.exchange_date)}
          </p>
        )}
      </Card.Body>
    </Card>
  )
}
