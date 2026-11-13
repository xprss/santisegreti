import { useState, type FormEvent } from 'react'
import { Alert, Card, Container, Form, Spinner } from 'react-bootstrap'
import { Button } from '../components/Button'
import { Link, useNavigate } from 'react-router'
import { useLogout, useMe, useUpdateMe } from '../api/hooks'
import type { Me } from '../api/types'
import { ErrorAlert } from '../components/feedback'
import { Gingerbread } from '../components/Gingerbread'
import { PALETTE } from '../lib/format'

const BIO_MAX = 280

export function Profile() {
  const me = useMe().data as Me
  const update = useUpdateMe()
  const logout = useLogout()
  const navigate = useNavigate()
  const [name, setName] = useState(me.name)
  const [bio, setBio] = useState(me.bio)
  const [color, setColor] = useState(me.color.toUpperCase())
  const [saved, setSaved] = useState(false)

  const submit = (event: FormEvent) => {
    event.preventDefault()
    setSaved(false)
    update.mutate({ name: name.trim(), bio: bio.trim(), color }, { onSuccess: () => setSaved(true) })
  }

  return (
    <Container className="ss-page ss-narrow">
      <Link to="/" className="small d-inline-block mb-2">
        ← Le tue stanze
      </Link>
      <h1 className="h2 mb-2">Il tuo profilo</h1>
      <p className="text-body-secondary mb-4">
        Nome, bio e colore li vedono le persone delle tue stanze, e aiutano chi ti ha pescato a
        scegliere il regalo.
      </p>

      <Card>
        <Card.Body>
          <div className="text-center mb-3">
            <Gingerbread color={color} size={88} title={`Il tuo omino, color ${color}`} />
          </div>
          <Form onSubmit={submit}>
            <Form.Group className="mb-3" controlId="profile-name">
              <Form.Label className="fw-semibold">Nome</Form.Label>
              <Form.Control
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={40}
                required
              />
            </Form.Group>

            <Form.Group className="mb-3" controlId="profile-bio">
              <Form.Label className="fw-semibold">Qualcosa di te</Form.Label>
              <Form.Control
                as="textarea"
                rows={3}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                maxLength={BIO_MAX}
                placeholder="Bevo solo tè, colleziono tazze, ho il pollice nero con le piante…"
              />
              <Form.Text>
                {bio.length}/{BIO_MAX}
              </Form.Text>
            </Form.Group>

            <fieldset className="mb-4">
              <legend className="fs-6 fw-semibold mb-2">Il tuo colore</legend>
              <div className="d-flex flex-wrap gap-2 mb-2">
                {PALETTE.map((swatch) => (
                  <button
                    key={swatch}
                    type="button"
                    className="ss-swatch"
                    style={{ backgroundColor: swatch }}
                    aria-pressed={color === swatch}
                    aria-label={`Colore ${swatch}`}
                    onClick={() => setColor(swatch)}
                  />
                ))}
              </div>
              <Form.Group controlId="profile-color" className="d-flex align-items-center gap-2">
                <Form.Control
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value.toUpperCase())}
                  title="Scegli un colore qualsiasi"
                />
                <Form.Label className="mb-0 small text-body-secondary">
                  oppure un colore qualsiasi
                </Form.Label>
              </Form.Group>
            </fieldset>

            <ErrorAlert error={update.error} />
            {saved && (
              <Alert variant="success" onClose={() => setSaved(false)} dismissible>
                Profilo aggiornato.
              </Alert>
            )}
            <div className="d-grid d-sm-flex">
              <Button type="submit" disabled={update.isPending}>
                {update.isPending && <Spinner animation="border" size="sm" className="me-2" />}
                Salva il profilo
              </Button>
            </div>
          </Form>
        </Card.Body>
      </Card>

      <div className="mt-4 text-center">
        <Button
          variant="link"
          className="text-body-secondary"
          onClick={() => logout.mutate(undefined, { onSuccess: () => navigate('/') })}
        >
          Esci dall'account
        </Button>
      </div>
    </Container>
  )
}
