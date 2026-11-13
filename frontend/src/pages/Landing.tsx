import { GoogleLogin, GoogleOAuthProvider } from '@react-oauth/google'
import { useState, type FormEvent } from 'react'
import { Alert, Card, Container, Form } from 'react-bootstrap'
import { Button } from '../components/Button'
import { useSearchParams } from 'react-router'
import type { AccessoryId } from '../accessories/catalog'
import { useConfig, useLogin } from '../api/hooks'
import { ErrorAlert, Loading } from '../components/feedback'
import { Gingerbread } from '../components/Gingerbread'
import { Logo } from '../components/Logo'

const DEMO: { color: string; accessory: AccessoryId }[] = [
  { color: '#C0392B', accessory: 'santa_hat' },
  { color: '#1E8449', accessory: 'sunglasses' },
  { color: '#D4A017', accessory: 'scarf' },
  { color: '#2E86C1', accessory: 'reindeer_antlers' },
  { color: '#C2185B', accessory: 'bow_tie' },
]

export function Landing() {
  const config = useConfig()
  const login = useLogin()
  const [params] = useSearchParams()
  const [googleFailed, setGoogleFailed] = useState(false)
  const hasInviteCode = params.has('codice')

  return (
    <Container className="ss-page ss-narrow text-center">
      <Logo size={88} className="mt-3 mb-3" />
      <h1 className="display-6 mb-3">santisegreti.it</h1>
      <p className="lead mb-2">Il Secret Santa senza bigliettini nel cappello.</p>
      <p className="text-body-secondary mb-4">
        Apri una stanza, invita chi vuoi con un codice, decidi chi non deve pescare chi. Al resto
        pensa l'estrazione, e ognuno scopre solo a chi fare il regalo.
      </p>

      <div className="d-flex justify-content-center gap-2 mt-4 mb-4" aria-hidden>
        {DEMO.map(({ color, accessory }) => (
          <Gingerbread key={color} color={color} accessory={accessory} size={40} />
        ))}
      </div>

      {hasInviteCode && (
        <Alert variant="light" className="border text-start">
          Ti hanno invitato in una stanza. Dopo l'accesso il codice è già pronto.
        </Alert>
      )}

      <Card className="text-start shadow-sm">
        <Card.Body>
          <h2 className="h5 mb-3">Si entra con Google</h2>
          {config.isPending && <Loading />}
          <ErrorAlert error={config.error} />
          {config.data?.google_client_id ? (
            <GoogleOAuthProvider clientId={config.data.google_client_id}>
              <div className="d-flex justify-content-center">
                <GoogleLogin
                  onSuccess={(response) => {
                    if (response.credential) login.mutate({ credential: response.credential })
                  }}
                  onError={() => setGoogleFailed(true)}
                  text="continue_with"
                  shape="pill"
                  width="300"
                />
              </div>
            </GoogleOAuthProvider>
          ) : (
            config.data && (
              <p className="text-body-secondary mb-0">
                L'accesso con Google non è ancora configurato su questo server.
              </p>
            )
          )}
          {googleFailed && (
            <Alert variant="warning" className="mt-3 mb-0">
              Google non ha completato l'accesso. Riproviamo?
            </Alert>
          )}
          <ErrorAlert error={login.error} className="mt-3 mb-0" />
          {config.data?.dev_login && <DevLogin />}
        </Card.Body>
      </Card>
    </Container>
  )
}

function DevLogin() {
  const login = useLogin()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')

  const submit = (event: FormEvent) => {
    event.preventDefault()
    login.mutate({ name, email })
  }

  return (
    <Form onSubmit={submit} className="mt-4 pt-3 border-top">
      <p className="small text-body-secondary mb-2">
        Accesso di prova, attivo solo in sviluppo.
      </p>
      <Form.Group className="mb-2" controlId="dev-name">
        <Form.Label className="visually-hidden">Nome</Form.Label>
        <Form.Control
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nome"
          required
        />
      </Form.Group>
      <Form.Group className="mb-3" controlId="dev-email">
        <Form.Label className="visually-hidden">Email</Form.Label>
        <Form.Control
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="nome@example.test"
          required
        />
      </Form.Group>
      <div className="d-grid">
        <Button type="submit" variant="outline-secondary" disabled={login.isPending}>
          Entra come utente di prova
        </Button>
      </div>
      <ErrorAlert error={login.error} className="mt-3 mb-0" />
    </Form>
  )
}
