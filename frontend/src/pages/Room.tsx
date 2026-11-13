import { lazy, Suspense, useState } from 'react'
import { Badge, Card, Col, Container, ListGroup, Row } from 'react-bootstrap'
import { Button } from '../components/Button'
import { Link, useNavigate, useParams } from 'react-router'
import { ApiError } from '../api/client'
import { useMe, useMyAssignment, useRemoveParticipant, useRoom } from '../api/hooks'
import type { Me, RoomDetail } from '../api/types'
import { Confirm, ErrorAlert, Loading } from '../components/feedback'
import { Gingerbread } from '../components/Gingerbread'
import { ParticipantsFallback } from '../scene/ParticipantsFallback'
import { canUseWebGL } from '../scene/webgl'
import { exchangeCountdown, formatDay, formatEuro, plural } from '../lib/format'

const ChristmasScene = lazy(() => import('../scene/ChristmasScene'))

export function Room() {
  const { id = '' } = useParams()
  const room = useRoom(id)
  const me = useMe().data as Me

  if (room.isPending) return <Loading />
  if (room.isError) {
    const missing = room.error instanceof ApiError && room.error.status === 404
    return (
      <Container className="ss-page ss-narrow">
        <ErrorAlert error={room.error} />
        {missing && <Link to="/">Torniamo alle tue stanze</Link>}
      </Container>
    )
  }

  const data = room.data
  return (
    <>
      <div className="ss-scene">
        {canUseWebGL() ? (
          <Suspense fallback={<ParticipantsFallback participants={data.participants} meId={me.id} />}>
            <ChristmasScene participants={data.participants} meId={me.id} />
          </Suspense>
        ) : (
          <ParticipantsFallback participants={data.participants} meId={me.id} />
        )}

        {/* Titolo e azioni sopra la scena: i tocchi fuori da qui arrivano al canvas. */}
        <Container className="ss-scene-header">
          <h1 className="h2 mb-0 me-auto">{data.name}</h1>
          {data.is_admin && (
            <Link to={`/stanze/${data.id}/gestisci`} className="btn btn-outline-light btn-sm">
              Gestisci la stanza
            </Link>
          )}
        </Container>
      </div>

      <Container className="ss-page">
        <Row className="g-3">
          <Col xs={12} lg={6}>
            <AssignmentCard room={data} />
          </Col>
          <Col xs={12} lg={6}>
            <DetailsCard room={data} />
          </Col>
          <Col xs={12}>
            <ParticipantsCard room={data} me={me} />
          </Col>
        </Row>
      </Container>
    </>
  )
}

function AssignmentCard({ room }: { room: RoomDetail }) {
  const drawn = room.status === 'drawn'
  const [revealed, setRevealed] = useState(false)
  const assignment = useMyAssignment(room.id, drawn && revealed)

  if (!drawn) {
    return (
      <Card className="h-100">
        <Card.Body>
          <h2 className="h5">A chi farai il regalo?</h2>
          <p className="text-body-secondary mb-0">
            L'estrazione non c'è ancora stata.{' '}
            {room.is_admin
              ? 'Quando ci siete tutti, la puoi lanciare da "Gestisci la stanza".'
              : "Appena l'admin la lancia, qui trovi il nome della persona a cui fare il regalo."}
          </p>
        </Card.Body>
      </Card>
    )
  }

  const receiver = assignment.data?.receiver
  return (
    <Card className="h-100 ss-reveal">
      <Card.Body>
        <h2 className="h5">A chi farai il regalo?</h2>
        {!revealed && (
          <>
            <p className="text-body-secondary">
              L'estrazione è fatta. Il nome resta coperto finché non lo vuoi vedere, così nessuno
              sbircia dallo schermo.
            </p>
            <div className="d-grid d-sm-flex">
              <Button variant="warning" onClick={() => setRevealed(true)}>
                Scopri il nome
              </Button>
            </div>
          </>
        )}
        {revealed && assignment.isPending && <Loading label="Apriamo la busta…" />}
        <ErrorAlert error={assignment.error} />
        {revealed && receiver && (
          <div className="d-flex gap-3 align-items-start">
            <Gingerbread
              color={receiver.color}
              accessory={receiver.accessory}
              size={56}
              className="flex-shrink-0 mt-2"
            />
            <div className="flex-grow-1">
              <p className="h4 mb-1">{receiver.name}</p>
              <p className="mb-3 text-body-secondary">
                {receiver.bio || 'Nessuna bio, per ora: un piccolo mistero in più.'}
              </p>
              <Button variant="outline-light" size="sm" onClick={() => setRevealed(false)}>
                Copri di nuovo
              </Button>
            </div>
          </div>
        )}
      </Card.Body>
    </Card>
  )
}

function DetailsCard({ room }: { room: RoomDetail }) {
  return (
    <Card className="h-100">
      <Card.Body>
        <h2 className="h5">Le regole del gioco</h2>
        <dl className="mb-0">
          <dt className="small text-body-secondary fw-normal">Budget per regalo</dt>
          <dd className="fs-5 fw-semibold">fino a {formatEuro(room.budget_eur)}</dd>
          <dt className="small text-body-secondary fw-normal">Tema</dt>
          <dd>{room.theme ?? 'Nessun tema: carta bianca.'}</dd>
          <dt className="small text-body-secondary fw-normal">Scambio dei regali</dt>
          <dd className="mb-0">
            {room.exchange_date ? (
              <>
                {formatDay(room.exchange_date)}
                <span className="d-block small text-secondary fw-semibold">
                  {exchangeCountdown(room.exchange_date)}
                </span>
              </>
            ) : (
              'Data ancora da decidere.'
            )}
          </dd>
        </dl>
      </Card.Body>
    </Card>
  )
}

function ParticipantsCard({ room, me }: { room: RoomDetail; me: Me }) {
  const leave = useRemoveParticipant(room.id)
  const navigate = useNavigate()
  const canLeave = !room.is_admin && room.status === 'open'

  return (
    <Card>
      <Card.Body className="pb-2">
        <h2 className="h5 mb-0">Chi c'è nella stanza</h2>
        <p className="small text-body-secondary mb-0">
          {plural(room.participants.length, 'persona', 'persone')}
        </p>
      </Card.Body>
      <ListGroup variant="flush">
        {room.participants.map((person) => (
          <ListGroup.Item key={person.id} className="d-flex gap-3 align-items-start py-3">
            <Gingerbread
              color={person.color}
              accessory={person.accessory}
              size={36}
              className="flex-shrink-0"
            />
            <div className="flex-grow-1 min-w-0">
              <div className="d-flex flex-wrap align-items-center gap-2">
                <span className="fw-semibold">{person.name}</span>
                {person.id === room.admin_id && (
                  <Badge bg="gold" text="dark">
                    admin
                  </Badge>
                )}
                {person.id === me.id && <span className="small text-body-secondary">(tu)</span>}
              </div>
              {person.bio && <p className="small text-body-secondary mb-0">{person.bio}</p>}
            </div>
          </ListGroup.Item>
        ))}
      </ListGroup>
      {canLeave && (
        <Card.Footer className="bg-transparent">
          <Confirm
            title="Esci dalla stanza?"
            confirmLabel="Sì, esco"
            variant="danger"
            onConfirm={() =>
              leave.mutateAsync(me.id).then(() => navigate('/', { replace: true }))
            }
            trigger={(open) => (
              <Button variant="link" className="px-0 text-danger" onClick={open}>
                Esci dalla stanza
              </Button>
            )}
          >
            Per rientrare servirà un nuovo codice di invito dall'admin.
          </Confirm>
        </Card.Footer>
      )}
    </Card>
  )
}
