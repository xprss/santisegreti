import { useState } from 'react'
import { Alert, Card, Container, ListGroup, Stack } from 'react-bootstrap'
import { Button } from '../components/Button'
import { Link, Navigate, useNavigate, useParams } from 'react-router'
import {
  useCreateLottery,
  useDeleteLottery,
  useDeleteRoom,
  useDraw,
  useDrawLottery,
  useLottery,
  useOpenLottery,
  useRemoveParticipant,
  useRoom,
  useUpdateRoom,
} from '../api/hooks'
import type { RoomDetail } from '../api/types'
import { ExclusionsCard } from '../components/ExclusionsCard'
import { Confirm, ErrorAlert, Loading } from '../components/feedback'
import { Gingerbread } from '../components/Gingerbread'
import { InviteCard } from '../components/InviteCard'
import { RoomForm } from '../components/RoomForm'
import { formatTimestamp, plural } from '../lib/format'

const MIN_PARTICIPANTS = 3
const MIN_TICKETS = 2

export function ManageRoom() {
  const { id = '' } = useParams()
  const room = useRoom(id)

  if (room.isPending) return <Loading />
  if (room.isError) {
    return (
      <Container className="ss-page ss-narrow">
        <ErrorAlert error={room.error} />
        <Link to="/">Torniamo alle tue stanze</Link>
      </Container>
    )
  }
  if (!room.data.is_admin) return <Navigate to={`/stanze/${id}`} replace />

  const data = room.data
  return (
    <Container className="ss-page ss-narrow">
      <h1 className="visually-hidden">Gestisci {data.name}</h1>
      <Stack gap={3}>
        <InviteCard room={data} />
        <ParticipantsCard room={data} />
        <ExclusionsCard room={data} />
        <DrawCard room={data} />
        <LotteryCard room={data} />
        <DetailsCard room={data} />
        <DeleteCard room={data} />
      </Stack>
    </Container>
  )
}

function ParticipantsCard({ room }: { room: RoomDetail }) {
  const remove = useRemoveParticipant(room.id)
  const open = room.status === 'open'

  return (
    <Card>
      <Card.Body className="pb-2">
        <h2 className="h5 mb-0">Partecipanti</h2>
        <p className="small text-body-secondary mb-0">
          {plural(room.participants.length, 'persona', 'persone')}
        </p>
      </Card.Body>
      <ListGroup variant="flush">
        {room.participants.map((person) => (
          <ListGroup.Item key={person.id} className="d-flex align-items-center gap-3 py-2">
            <Gingerbread
              color={person.color}
              accessory={person.accessory}
              size={30}
              className="flex-shrink-0"
            />
            <span className="flex-grow-1">
              {person.name}
              {person.id === room.admin_id && (
                <span className="small text-body-secondary"> (tu, admin)</span>
              )}
            </span>
            {open && person.id !== room.admin_id && (
              <Confirm
                title={`Far uscire ${person.name}?`}
                confirmLabel="Sì, fallo uscire"
                variant="danger"
                onConfirm={() => remove.mutateAsync(person.id)}
                trigger={(show) => (
                  <Button variant="outline-danger" size="sm" onClick={show}>
                    Fai uscire
                  </Button>
                )}
              >
                Esce anche dai gruppi di esclusione. Per rientrare servirà un nuovo codice.
              </Confirm>
            )}
          </ListGroup.Item>
        ))}
      </ListGroup>
    </Card>
  )
}

function DrawCard({ room }: { room: RoomDetail }) {
  const draw = useDraw(room.id)
  const navigate = useNavigate()
  const enough = room.participants.length >= MIN_PARTICIPANTS

  if (room.status === 'drawn') {
    return (
      <Card>
        <Card.Body>
          <h2 className="h5">Estrazione</h2>
          <p className="mb-3">
            Fatta {room.drawn_at ? `il ${formatTimestamp(room.drawn_at)}` : ''}. Ognuno trova il
            proprio abbinamento nella pagina della stanza, e nessuno vede quelli degli altri,
            nemmeno tu.
          </p>
          <Confirm
            title="Annullare l'estrazione?"
            confirmLabel="Sì, annulla l'estrazione"
            variant="danger"
            onConfirm={() => draw.mutateAsync('cancel')}
            trigger={(show) => (
              <Button variant="outline-danger" onClick={show}>
                Annulla l'estrazione
              </Button>
            )}
          >
            Gli abbinamenti attuali spariscono e la stanza torna aperta: si potranno invitare
            persone, cambiare i gruppi e rifare l'estrazione. Chi ha già visto il proprio nome ne
            riceverà uno nuovo.
          </Confirm>
        </Card.Body>
      </Card>
    )
  }

  return (
    <Card>
      <Card.Body>
        <h2 className="h5">Estrazione</h2>
        <p className="text-body-secondary">
          {enough
            ? 'Quando ci siete tutti si può estrarre. Dopo, la stanza si chiude: niente nuovi ingressi finché non la annulli.'
            : `Per l'estrazione servono almeno ${MIN_PARTICIPANTS} persone. Per ora siete in ${room.participants.length}.`}
        </p>
        <Confirm
          title="Facciamo l'estrazione?"
          confirmLabel="Sì, estrai"
          onConfirm={() => draw.mutateAsync('draw').then(() => navigate(`/stanze/${room.id}`))}
          trigger={(show) => (
            <div className="d-grid d-sm-flex">
              <Button onClick={show} disabled={!enough}>
                Fai l'estrazione
              </Button>
            </div>
          )}
        >
          Siete in {room.participants.length}
          {room.exclusion_groups.length > 0 &&
            `, con ${plural(room.exclusion_groups.length, 'gruppo', 'gruppi')} di esclusione`}
          . Ognuno riceverà il nome di una persona a cui fare il regalo.
        </Confirm>
      </Card.Body>
    </Card>
  )
}

/** La lotteria della stanza: una sola, si crea in bozza, si apre e poi si estrae in diretta. */
function LotteryCard({ room }: { room: RoomDetail }) {
  const lottery = useLottery(room.id)
  const create = useCreateLottery(room.id)
  const open = useOpenLottery(room.id)
  const remove = useDeleteLottery(room.id)
  const draw = useDrawLottery(room.id)
  const navigate = useNavigate()
  const data = lottery.data

  const cancel = (
    <Confirm
      title="Eliminare la lotteria?"
      confirmLabel="Sì, eliminala"
      variant="danger"
      onConfirm={() => remove.mutateAsync()}
      trigger={(show) => (
        <Button variant="outline-danger" onClick={show}>
          Elimina la lotteria
        </Button>
      )}
    >
      {data?.ticket_count
        ? `I ${data.ticket_count} biglietti già presi spariscono. `
        : ''}
      Potrai crearne un'altra, finché non estrai.
    </Confirm>
  )

  return (
    <Card>
      <Card.Body>
        <h2 className="h5">Lotteria</h2>
        <ErrorAlert error={lottery.error || create.error || open.error} />
        {lottery.isPending ? null : !data ? (
          <>
            <p className="text-body-secondary">
              Una lotteria per stanza, con un premio speciale che non si trova da nessun'altra
              parte. Nasce chiusa: la vedi solo tu finché non la apri.
            </p>
            <div className="d-grid d-sm-flex">
              <Button onClick={() => create.mutate()} disabled={create.isPending}>
                Crea la lotteria
              </Button>
            </div>
          </>
        ) : data.status === 'draft' ? (
          <>
            <p className="text-body-secondary">
              È pronta ma ancora chiusa. Quando la apri, tutti possono prendere il biglietto.
            </p>
            <div className="d-grid d-sm-flex gap-2">
              <Button onClick={() => open.mutate()} disabled={open.isPending}>
                Apri ai partecipanti
              </Button>
              {cancel}
            </div>
          </>
        ) : data.status === 'open' ? (
          <>
            <p className="text-body-secondary">
              {plural(data.ticket_count, 'biglietto preso', 'biglietti presi')}.{' '}
              {data.ticket_count >= MIN_TICKETS
                ? "Quando lanci l'estrazione parte un conto alla rovescia in diretta per chi ha la stanza aperta."
                : `Per estrarre servono almeno ${MIN_TICKETS} biglietti.`}
            </p>
            <div className="d-grid d-sm-flex gap-2">
              <Confirm
                title="Estraiamo la lotteria?"
                confirmLabel="Sì, via al conto alla rovescia"
                onConfirm={() => draw.mutateAsync().then(() => navigate(`/stanze/${room.id}`))}
                trigger={(show) => (
                  <Button onClick={show} disabled={data.ticket_count < MIN_TICKETS}>
                    Estrai il vincitore
                  </Button>
                )}
              >
                Da adesso non si prendono più biglietti. Parte un conto alla rovescia uguale per
                tutti i collegati, poi il vincitore compare a tutti insieme. Non si torna indietro.
              </Confirm>
              {cancel}
            </div>
          </>
        ) : data.status === 'countdown' ? (
          <p className="mb-0">
            Estrazione in corso: <Link to={`/stanze/${room.id}`}>guardala nella stanza</Link>.
          </p>
        ) : (
          <p className="mb-0">
            Estratta{data.drawn_at ? ` il ${formatTimestamp(data.drawn_at)}` : ''}: ha vinto{' '}
            <strong>{data.winner?.user.name}</strong> con il biglietto {data.winner?.number}.
          </p>
        )}
      </Card.Body>
    </Card>
  )
}

function DetailsCard({ room }: { room: RoomDetail }) {
  const update = useUpdateRoom(room.id)
  const [saved, setSaved] = useState(false)

  return (
    <Card>
      <Card.Body>
        <h2 className="h5 mb-3">Dettagli della stanza</h2>
        <ErrorAlert error={update.error} />
        {saved && (
          <Alert variant="success" onClose={() => setSaved(false)} dismissible>
            Modifiche salvate.
          </Alert>
        )}
        <RoomForm
          key={`${room.name}-${room.budget_eur}-${room.theme}-${room.exchange_date}`}
          initial={room}
          submitLabel="Salva le modifiche"
          busy={update.isPending}
          onSubmit={(input) => {
            setSaved(false)
            update.mutate(input, { onSuccess: () => setSaved(true) })
          }}
        />
      </Card.Body>
    </Card>
  )
}

function DeleteCard({ room }: { room: RoomDetail }) {
  const remove = useDeleteRoom(room.id)
  const navigate = useNavigate()

  return (
    <Card border="danger-subtle">
      <Card.Body>
        <h2 className="h5">Eliminare la stanza</h2>
        <p className="text-body-secondary">
          Spariscono la stanza, i partecipanti e gli abbinamenti, per tutti.
        </p>
        <Confirm
          title={`Eliminare "${room.name}"?`}
          confirmLabel="Sì, elimina per sempre"
          variant="danger"
          onConfirm={() => remove.mutateAsync().then(() => navigate('/', { replace: true }))}
          trigger={(show) => (
            <Button variant="outline-danger" onClick={show}>
              Elimina la stanza
            </Button>
          )}
        >
          Non si torna indietro: la stanza sparisce anche per gli altri partecipanti.
        </Confirm>
      </Card.Body>
    </Card>
  )
}
