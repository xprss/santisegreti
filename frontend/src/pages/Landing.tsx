import { GoogleLogin, GoogleOAuthProvider } from '@react-oauth/google'
import {
  lazy,
  Suspense,
  useLayoutEffect,
  useRef,
  useState,
  type FormEvent,
  type RefObject,
} from 'react'
import { Alert, Card, Container, Form } from 'react-bootstrap'
import { useSearchParams } from 'react-router'
import type { AccessoryId } from '../accessories/catalog'
import { useConfig, useLogin } from '../api/hooks'
import type { UserPublic } from '../api/types'
import { Button } from '../components/Button'
import { ErrorAlert, Loading } from '../components/feedback'
import { Gingerbread } from '../components/Gingerbread'
import { Logo } from '../components/Logo'
import { ScrollHint } from '../components/ScrollHint'
import { useSceneSnap } from '../lib/useSceneSnap'
import { canUseWebGL } from '../scene/webgl'

const ChristmasScene = lazy(() => import('../scene/ChristmasScene'))

/** Gli omini che ballano attorno all'albero della pagina di accesso. */
const DEMO: { color: string; accessory: AccessoryId }[] = [
  { color: '#C0392B', accessory: 'santa_hat' },
  { color: '#1E8449', accessory: 'sunglasses' },
  { color: '#D4A017', accessory: 'scarf' },
  { color: '#2E86C1', accessory: 'reindeer_antlers' },
  { color: '#C2185B', accessory: 'bow_tie' },
  { color: '#7D3C98', accessory: 'elf_hat' },
  { color: '#E67E22', accessory: 'crown' },
  { color: '#16A085', accessory: 'headphones' },
]

const DEMO_PEOPLE: UserPublic[] = DEMO.map(({ color, accessory }, i) => ({
  id: `demo-${i}`,
  name: '',
  bio: '',
  color,
  accessory,
  avatar_url: null,
}))

const STEPS = [
  {
    icon: 'bi-tree-fill',
    tone: 'green',
    title: 'Apri una stanza',
    text: 'Le dai un nome, fissi il budget e la data dello scambio.',
  },
  {
    icon: 'bi-envelope-paper-heart-fill',
    tone: 'red',
    title: 'Invita chi vuoi',
    text: 'Un codice per ogni persona: lo giri in chat o a voce, e vale tre minuti.',
  },
  {
    icon: 'bi-shuffle',
    tone: 'gold',
    title: 'Decidi chi non pesca chi',
    text: 'Coppie e famiglie nello stesso gruppo non si pescano a vicenda.',
  },
  {
    icon: 'bi-gift-fill',
    tone: 'red',
    title: "Via all'estrazione",
    text: 'Ognuno scopre solo a chi fare il regalo. Il segreto resta segreto.',
  },
] as const

/** Quanto spazio occupa il pannello dal fondo della scena (in pixel), per inquadrare sopra. */
function usePanelSpace(panel: RefObject<HTMLDivElement | null>) {
  const [space, setSpace] = useState(0)
  useLayoutEffect(() => {
    const element = panel.current
    const scene = element?.parentElement
    if (!element || !scene) return
    const update = () =>
      setSpace(scene.getBoundingClientRect().bottom - element.getBoundingClientRect().top)
    update()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(update)
    observer.observe(element)
    observer.observe(scene)
    return () => observer.disconnect()
  }, [panel])
  return space
}

export function Landing() {
  const config = useConfig()
  const login = useLogin()
  const [params] = useSearchParams()
  const [googleFailed, setGoogleFailed] = useState(false)
  const below = useRef<HTMLDivElement>(null)
  const devCard = useRef<HTMLDivElement>(null)
  const hasInviteCode = params.has('codice')
  const panel = useRef<HTMLDivElement>(null)
  const panelSpace = usePanelSpace(panel)
  const googleId = config.data?.google_client_id
  useSceneSnap()

  return (
    <>
      <div className="ss-scene ss-scene--landing">
        {canUseWebGL() && (
          <Suspense fallback={null}>
            <ChristmasScene
              participants={DEMO_PEOPLE}
              meId=""
              interactive={false}
              bottomInset={panelSpace}
            />
          </Suspense>
        )}

        <div className="ss-hero-title">
          <Logo size={64} className="ss-hero-hat" />
          <h1>santisegreti.it</h1>
          <p>Il Secret Santa senza bigliettini nel cappello</p>
        </div>

        <div ref={panel} className="ss-hero-panel">
          {hasInviteCode && (
            <p className="ss-hero-invite">
              <i className="bi bi-envelope-heart-fill" aria-hidden /> Ti hanno invitato in una stanza:
              dopo l'accesso il codice è già pronto.
            </p>
          )}
          {config.isPending && <Loading />}
          <ErrorAlert error={config.error} />
          {googleId ? (
            <GoogleOAuthProvider clientId={googleId}>
              <div className="d-flex justify-content-center">
                <GoogleLogin
                  onSuccess={(response) => {
                    if (response.credential) login.mutate({ credential: response.credential })
                  }}
                  onError={() => setGoogleFailed(true)}
                  text="continue_with"
                  shape="pill"
                  width="280"
                />
              </div>
            </GoogleOAuthProvider>
          ) : (
            config.data && (
              <>
                <p className="ss-hero-note">L'accesso con Google non è ancora configurato.</p>
                {config.data.dev_login && (
                  <Button
                    variant="warning"
                    className="w-100"
                    onClick={() => devCard.current?.scrollIntoView({ behavior: 'smooth' })}
                  >
                    Entra con l'accesso di prova
                  </Button>
                )}
              </>
            )
          )}
          {googleFailed && (
            <Alert variant="warning" className="mt-3 mb-0">
              Google non ha completato l'accesso. Riproviamo?
            </Alert>
          )}
          <ErrorAlert error={login.error} className="mt-3 mb-0" />
        </div>

        <ScrollHint
          label="Come funziona"
          onClick={() => below.current?.scrollIntoView({ behavior: 'smooth' })}
        />
      </div>

      <Container ref={below} className="ss-page ss-narrow ss-snap-start">
        <h2 className="ss-steps-title">Come funziona</h2>
        <ol className="ss-steps">
          {STEPS.map((step, i) => (
            <li key={step.title} className={`ss-step ss-step--${step.tone}`}>
              <span className="ss-step-icon" aria-hidden>
                <i className={`bi ${step.icon}`} />
                <span className="ss-step-number">{i + 1}</span>
              </span>
              <div>
                <h3>{step.title}</h3>
                <p>{step.text}</p>
              </div>
            </li>
          ))}
        </ol>

        <div className="ss-steps-cookies" aria-hidden>
          {DEMO.slice(0, 5).map(({ color, accessory }) => (
            <Gingerbread key={color} color={color} accessory={accessory} size={40} />
          ))}
        </div>

        {config.data?.dev_login && (
          <Card ref={devCard} className="text-start shadow-sm mt-4">
            <Card.Body>
              <DevLogin />
            </Card.Body>
          </Card>
        )}
      </Container>
    </>
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
    <Form onSubmit={submit}>
      <h2 className="h5 mb-1">Accesso di prova</h2>
      <p className="small text-body-secondary mb-3">Attivo solo in sviluppo.</p>
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
