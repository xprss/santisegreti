import { Card, Container } from 'react-bootstrap'
import { useNavigate } from 'react-router'
import { useCreateRoom } from '../api/hooks'
import { ErrorAlert } from '../components/feedback'
import { RoomForm } from '../components/RoomForm'

export function NewRoom() {
  const create = useCreateRoom()
  const navigate = useNavigate()

  return (
    <Container className="ss-page ss-narrow">
      <h1 className="h2 mb-4">Una nuova stanza segreta</h1>
      <Card>
        <Card.Body>
          <ErrorAlert error={create.error} />
          <RoomForm
            submitLabel="Apri la stanza"
            busy={create.isPending}
            onSubmit={(input) =>
              create.mutate(input, {
                onSuccess: (room) => navigate(`/stanze/${room.id}/gestisci`, { replace: true }),
              })
            }
          />
        </Card.Body>
      </Card>
    </Container>
  )
}
