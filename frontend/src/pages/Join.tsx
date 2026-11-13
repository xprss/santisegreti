import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { Card, Container, Form, Spinner } from 'react-bootstrap'
import { Button } from '../components/Button'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { useRedeemInvite } from '../api/hooks'
import { ErrorAlert } from '../components/feedback'

const CODE_LENGTH = 6

function cleanCode(value: string) {
  return value
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, CODE_LENGTH)
}

export function Join() {
  const [params] = useSearchParams()
  const [code, setCode] = useState(() => cleanCode(params.get('codice') ?? ''))
  const redeem = useRedeemInvite()
  const navigate = useNavigate()
  const autoSubmitted = useRef(false)

  const { mutate } = redeem
  const join = useCallback(
    (value: string) =>
      mutate(value, {
        onSuccess: (result) => navigate(`/stanze/${result.room_id}`, { replace: true }),
      }),
    [mutate, navigate],
  )

  // Arrivando dal link di invito il codice è già completo: si entra subito.
  useEffect(() => {
    const fromLink = cleanCode(params.get('codice') ?? '')
    if (autoSubmitted.current || fromLink.length !== CODE_LENGTH) return
    autoSubmitted.current = true
    join(fromLink)
  }, [join, params])

  const submit = (event: FormEvent) => {
    event.preventDefault()
    join(code)
  }

  return (
    <Container className="ss-page ss-narrow">
      <Link to="/" className="small d-inline-block mb-2">
        ← Le tue stanze
      </Link>
      <h1 className="h2 mb-2">Hai un codice di invito?</h1>
      <p className="text-body-secondary mb-4">
        È fatto di {CODE_LENGTH} caratteri e dura 3 minuti. Se nel frattempo è scaduto, l'admin
        della stanza ne genera uno nuovo in un attimo.
      </p>
      <Card>
        <Card.Body>
          <Form onSubmit={submit}>
            <Form.Group className="mb-3" controlId="invite-code">
              <Form.Label className="visually-hidden">Codice di invito</Form.Label>
              <Form.Control
                className="ss-code-input"
                value={code}
                onChange={(e) => setCode(cleanCode(e.target.value))}
                placeholder="ABC234"
                autoComplete="one-time-code"
                autoCapitalize="characters"
                spellCheck={false}
                inputMode="text"
                autoFocus
              />
            </Form.Group>
            <ErrorAlert error={redeem.error} />
            <div className="d-grid">
              <Button type="submit" disabled={code.length !== CODE_LENGTH || redeem.isPending}>
                {redeem.isPending && <Spinner animation="border" size="sm" className="me-2" />}
                Entra nella stanza
              </Button>
            </div>
          </Form>
        </Card.Body>
      </Card>
    </Container>
  )
}
