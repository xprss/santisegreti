import { useState, type FormEvent } from 'react'
import { Card, Form, ListGroup, Spinner } from 'react-bootstrap'
import { Button } from './Button'
import { useDeleteExclusion, useSaveExclusion } from '../api/hooks'
import type { ExclusionGroup, RoomDetail } from '../api/types'
import { ErrorAlert } from './feedback'

export function ExclusionsCard({ room }: { room: RoomDetail }) {
  const [editing, setEditing] = useState<ExclusionGroup | 'new' | null>(null)
  const remove = useDeleteExclusion(room.id)
  const locked = room.status === 'drawn'
  const names = new Map(room.participants.map((p) => [p.id, p.name]))

  return (
    <Card>
      <Card.Body className={room.exclusion_groups.length ? 'pb-2' : undefined}>
        <h2 className="h5">Chi non deve pescare chi</h2>
        <p className="text-body-secondary mb-0">
          Chi sta nello stesso gruppo non si pesca a vicenda: comodo per coppie, famiglie o chi si
          fa già un regalo per conto suo.
        </p>
        {locked && (
          <p className="small text-body-secondary mt-2 mb-0">
            A estrazione fatta i gruppi restano così. Per cambiarli serve prima annullarla.
          </p>
        )}
      </Card.Body>

      {room.exclusion_groups.length > 0 && (
        <ListGroup variant="flush">
          {room.exclusion_groups.map((group) => (
            <ListGroup.Item key={group.id} className="py-3">
              <div className="d-flex justify-content-between align-items-start gap-2">
                <div>
                  <div className="fw-semibold">{group.name}</div>
                  <div className="small text-body-secondary">
                    {group.member_ids.map((id) => names.get(id) ?? '…').join(', ')}
                  </div>
                </div>
                {!locked && (
                  <div className="d-flex gap-1 flex-shrink-0">
                    <Button variant="outline-secondary" size="sm" onClick={() => setEditing(group)}>
                      Modifica
                    </Button>
                    <Button
                      variant="outline-danger"
                      size="sm"
                      disabled={remove.isPending}
                      onClick={() => remove.mutate(group.id)}
                      aria-label={`Elimina il gruppo ${group.name}`}
                    >
                      Elimina
                    </Button>
                  </div>
                )}
              </div>
              {editing !== 'new' && editing?.id === group.id && (
                <GroupForm room={room} group={group} onDone={() => setEditing(null)} />
              )}
            </ListGroup.Item>
          ))}
        </ListGroup>
      )}

      {!locked && (
        <Card.Body className="pt-2">
          <ErrorAlert error={remove.error} />
          {editing === 'new' ? (
            <GroupForm room={room} onDone={() => setEditing(null)} />
          ) : (
            room.participants.length >= 2 && (
              <Button variant="outline-secondary" onClick={() => setEditing('new')}>
                Aggiungi un gruppo
              </Button>
            )
          )}
        </Card.Body>
      )}
    </Card>
  )
}

function GroupForm({
  room,
  group,
  onDone,
}: {
  room: RoomDetail
  group?: ExclusionGroup
  onDone: () => void
}) {
  const save = useSaveExclusion(room.id)
  const [name, setName] = useState(group?.name ?? '')
  const [members, setMembers] = useState<Set<string>>(new Set(group?.member_ids ?? []))

  const toggle = (id: string) =>
    setMembers((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const submit = (event: FormEvent) => {
    event.preventDefault()
    save.mutate(
      { id: group?.id, name: name.trim(), member_ids: [...members] },
      { onSuccess: onDone },
    )
  }

  return (
    <Form onSubmit={submit} className="mt-3 p-3 rounded-3 bg-body-tertiary">
      <Form.Group className="mb-3" controlId={`group-name-${group?.id ?? 'new'}`}>
        <Form.Label className="fw-semibold">Nome del gruppo</Form.Label>
        <Form.Control
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Famiglia Rossi"
          maxLength={60}
          required
        />
      </Form.Group>
      <fieldset className="mb-3">
        <legend className="fs-6 fw-semibold mb-2">Chi ne fa parte</legend>
        {room.participants.map((person) => (
          <Form.Check
            key={person.id}
            id={`member-${group?.id ?? 'new'}-${person.id}`}
            type="checkbox"
            label={person.name}
            checked={members.has(person.id)}
            onChange={() => toggle(person.id)}
            className="py-1"
          />
        ))}
      </fieldset>
      <ErrorAlert error={save.error} />
      <div className="ss-actions">
        <Button type="submit" disabled={members.size < 2 || !name.trim() || save.isPending}>
          {save.isPending && <Spinner animation="border" size="sm" className="me-2" />}
          Salva il gruppo
        </Button>
        <Button variant="outline-secondary" onClick={onDone}>
          Lasciamo stare
        </Button>
      </div>
      {members.size < 2 && (
        <Form.Text className="d-block mt-2">Servono almeno due persone.</Form.Text>
      )}
    </Form>
  )
}
