import { lazy, Suspense, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
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
import { daysUntil, formatEuro, parseDay, plural } from '../lib/format'

const ChristmasScene = lazy(() => import('../scene/ChristmasScene'))

/** Stelline che brillano sullo sfondo della rivelazione (posizioni fisse, ritmi diversi). */
const STARS: CSSProperties[] = Array.from({ length: 28 }, (_, i) => {
  const r = (n: number) => ((Math.sin(i * 12.9898 + n * 78.233) * 43758.5453) % 1 + 1) % 1
  return {
    left: `${(r(1) * 96 + 2).toFixed(1)}%`,
    top: `${(r(2) * 92 + 3).toFixed(1)}%`,
    '--s': `${(0.35 + r(3) * 0.75).toFixed(2)}rem`,
    '--d': `${(r(4) * 2.4).toFixed(2)}s`,
    '--t': `${(1.4 + r(5) * 1.8).toFixed(2)}s`,
  } as CSSProperties
})

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
      <div className={data.is_admin ? 'ss-scene ss-scene--with-cta' : 'ss-scene'}>
        {canUseWebGL() ? (
          <Suspense fallback={<ParticipantsFallback participants={data.participants} meId={me.id} />}>
            <ChristmasScene participants={data.participants} meId={me.id} />
          </Suspense>
        ) : (
          <ParticipantsFallback participants={data.participants} meId={me.id} />
        )}

        {/* Titolo e azioni sopra la scena: i tocchi fuori da qui arrivano al canvas. */}
        <Container className="ss-scene-header">
          <h1 className="h2 mb-0">{data.name}</h1>
        </Container>
        {data.is_admin && (
          <div className="ss-scene-cta">
            <Link to={`/stanze/${data.id}/gestisci`} className="btn btn-warning">
              Gestisci la stanza
            </Link>
          </div>
        )}
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

  if (!revealed) {
    // Tutta la scheda è il bottone: brilla finché non la tocchi.
    return (
      <button type="button" className="ss-reveal-trigger h-100" onClick={() => setRevealed(true)}>
        <span className="ss-reveal-trigger-title">A chi farai il regalo?</span>
      </button>
    )
  }

  if (!receiver) {
    return (
      <Card className="h-100 ss-reveal">
        <Card.Body>
          {assignment.isPending && <Loading label="Apriamo la busta…" />}
          <ErrorAlert error={assignment.error} />
        </Card.Body>
      </Card>
    )
  }

  // Il gran finale: busto dell'omino a sinistra, nome enorme che gli passa sopra, scintille ovunque.
  return (
    <section className="ss-reveal-stage h-100" aria-live="polite">
      <div className="ss-reveal-rays" aria-hidden />
      <div className="ss-reveal-stars" aria-hidden>
        {STARS.map((star, i) => (
          <span key={i} style={star} />
        ))}
      </div>
      <Gingerbread
        color={receiver.color}
        accessory={receiver.accessory}
        size={250}
        className="ss-reveal-omino"
      />
      <div className="ss-reveal-flash" aria-hidden />
      <RevealName name={receiver.name} />
      <div className="ss-reveal-burst" aria-hidden>
        {Array.from({ length: 14 }, (_, i) => (
          <span key={i} style={{ '--i': i } as CSSProperties} />
        ))}
      </div>
      <Button
        variant="outline-light"
        size="sm"
        className="ss-reveal-hide"
        onClick={() => setRevealed(false)}
      >
        Copri di nuovo
      </Button>
    </section>
  )
}

/**
 * Il nome più grande possibile: parte da un corpo enorme e scende finché non sta nel suo spazio
 * (quasi tutta la larghezza, sopra l'omino, senza spezzare le parole).
 */
function RevealName({ name }: { name: string }) {
  const ref = useRef<HTMLHeadingElement>(null)
  const [size, setSize] = useState<number | null>(null)

  useLayoutEffect(() => {
    const element = ref.current
    const stage = element?.parentElement
    if (!element || !stage) return
    const fit = () => {
      const maxHeight = stage.clientHeight * 0.72
      let px = Math.min(112, stage.clientWidth * 0.26)
      element.style.setProperty('--ss-name-size', `${px}px`)
      while (
        px > 22 &&
        (element.scrollWidth > element.clientWidth + 1 || element.scrollHeight > maxHeight)
      ) {
        px *= 0.92
        element.style.setProperty('--ss-name-size', `${px}px`)
      }
      setSize(px)
    }
    fit()
    const observer = new ResizeObserver(fit)
    observer.observe(stage)
    return () => observer.disconnect()
  }, [name])

  return (
    <h2
      ref={ref}
      className="ss-reveal-name"
      style={size ? ({ '--ss-name-size': `${size}px` } as CSSProperties) : undefined}
    >
      <span className="visually-hidden">Farai il regalo a </span>
      {name}
    </h2>
  )
}

const MONTHS = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic']

function countdownLabel(days: number): string {
  if (days > 1) return `tra ${days} giorni`
  if (days === 1) return 'domani!'
  if (days === 0) return 'oggi!'
  return 'è già passato'
}

/** Le regole del gioco come tre bigliettini attaccati al verde: budget, data, tema. */
function DetailsCard({ room }: { room: RoomDetail }) {
  const date = room.exchange_date ? parseDay(room.exchange_date) : null
  const days = room.exchange_date ? daysUntil(room.exchange_date) : null

  return (
    <section className="ss-rules h-100" aria-labelledby="rules-title">
      <h2 id="rules-title" className="visually-hidden">
        Le regole del gioco
      </h2>

      <div className="ss-rule ss-rule--budget">
        <span className="ss-rule-caption">si spende al massimo</span>
        <span className="ss-rule-big">{formatEuro(room.budget_eur)}</span>
        <span className="ss-rule-caption">a regalo, non un centesimo di più</span>
      </div>

      <div className="ss-rule ss-rule--date">
        <div className="ss-calendar" aria-hidden={!date}>
          <span className="ss-calendar-month">{date ? MONTHS[date.getMonth()] : '???'}</span>
          <span className="ss-calendar-day">{date ? date.getDate() : '?'}</span>
        </div>
        <span className="ss-rule-caption">
          {days !== null ? (
            <>
              scambio dei regali
              <strong className="d-block">{countdownLabel(days)}</strong>
            </>
          ) : (
            <>
              scambio dei regali
              <strong className="d-block">data da decidere</strong>
            </>
          )}
        </span>
      </div>

      <div className="ss-rule ss-rule--theme">
        <span className="ss-rule-caption">il tema</span>
        <span className="ss-rule-theme">
          {room.theme ? `“${room.theme}”` : 'Carta bianca: libertà totale!'}
        </span>
      </div>
    </section>
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
