import { useState, type FormEvent } from 'react'
import { Form, InputGroup, Spinner } from 'react-bootstrap'
import { Button } from './Button'
import type { RoomInput } from '../api/types'

interface RoomFormProps {
  initial?: Partial<RoomInput>
  submitLabel: string
  busy: boolean
  onSubmit: (input: RoomInput) => void
}

export function RoomForm({ initial, submitLabel, busy, onSubmit }: RoomFormProps) {
  const [name, setName] = useState(initial?.name ?? '')
  const [budget, setBudget] = useState(String(initial?.budget_eur ?? 25))
  const [theme, setTheme] = useState(initial?.theme ?? '')
  const [date, setDate] = useState(initial?.exchange_date ?? '')

  const submit = (event: FormEvent) => {
    event.preventDefault()
    onSubmit({
      name: name.trim(),
      budget_eur: Number(budget),
      theme: theme.trim() || null,
      exchange_date: date || null,
    })
  }

  return (
    <Form onSubmit={submit}>
      <Form.Group className="mb-3" controlId="room-name">
        <Form.Label className="fw-semibold">Come la chiamiamo?</Form.Label>
        <Form.Control
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Natale in ufficio"
          maxLength={80}
          required
        />
      </Form.Group>

      <Form.Group className="mb-3" controlId="room-budget">
        <Form.Label className="fw-semibold">Budget per ogni regalo</Form.Label>
        <InputGroup>
          <Form.Control
            type="number"
            inputMode="numeric"
            min={1}
            max={10000}
            value={budget}
            onChange={(e) => setBudget(e.target.value)}
            required
          />
          <InputGroup.Text>€</InputGroup.Text>
        </InputGroup>
      </Form.Group>

      <Form.Group className="mb-3" controlId="room-theme">
        <Form.Label className="fw-semibold">Un tema, se vi va</Form.Label>
        <Form.Control
          value={theme}
          onChange={(e) => setTheme(e.target.value)}
          placeholder="Fatto a mano, un libro, qualcosa di rosso…"
          maxLength={120}
        />
        <Form.Text>Si può aggiungere o cambiare anche più avanti.</Form.Text>
      </Form.Group>

      <Form.Group className="mb-4" controlId="room-date">
        <Form.Label className="fw-semibold">Quando vi scambiate i regali?</Form.Label>
        <Form.Control type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <Form.Text>Facoltativo: nella stanza comparirà il conto alla rovescia.</Form.Text>
      </Form.Group>

      <div className="d-grid d-sm-flex">
        <Button type="submit" disabled={busy}>
          {busy ? <Spinner animation="border" size="sm" className="me-2" /> : null}
          {submitLabel}
        </Button>
      </div>
    </Form>
  )
}
