import { useEffect, useState } from 'react'
import { Card, ProgressBar, Spinner } from 'react-bootstrap'
import { Button } from './Button'
import { useCreateInvite } from '../api/hooks'
import type { Invite, RoomDetail } from '../api/types'
import { ErrorAlert } from './feedback'

/** Secondi rimasti, contati dall'orologio del browser a partire dalla durata data dal server. */
function useSecondsLeft(expiresAtMs: number | undefined): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!expiresAtMs) return
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [expiresAtMs])
  if (!expiresAtMs) return 0
  return Math.max(0, Math.ceil((expiresAtMs - now) / 1000))
}

function formatSeconds(total: number): string {
  const minutes = Math.floor(total / 60)
  const seconds = total % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

const TOTAL_SECONDS = 180

export function InviteCard({ room }: { room: RoomDetail }) {
  const create = useCreateInvite(room.id)
  const [invite, setInvite] = useState<(Invite & { expiresAtMs: number }) | null>(null)
  const [copied, setCopied] = useState<'code' | 'link' | null>(null)
  const secondsLeft = useSecondsLeft(invite?.expiresAtMs)
  const active = invite !== null && secondsLeft > 0
  const link = invite ? `${window.location.origin}/unisciti?codice=${invite.code}` : ''
  const canShare = typeof navigator.share === 'function'

  const generate = () => {
    setCopied(null)
    create.mutate(undefined, {
      onSuccess: (result) =>
        setInvite({ ...result, expiresAtMs: Date.now() + result.expires_in * 1000 }),
    })
  }

  const copy = async (what: 'code' | 'link') => {
    if (!invite) return
    try {
      await navigator.clipboard.writeText(what === 'code' ? invite.code : link)
      setCopied(what)
    } catch {
      setCopied(null)
    }
  }

  const share = () =>
    navigator
      .share({
        title: room.name,
        text: `Ti aspettiamo nella stanza "${room.name}" su santisegreti.it. Il codice vale 3 minuti: ${invite?.code}`,
        url: link,
      })
      .catch(() => undefined)

  if (room.status === 'drawn') {
    return (
      <Card>
        <Card.Body>
          <h2 className="h5">Inviti</h2>
          <p className="text-body-secondary mb-0">
            Con l'estrazione fatta la stanza è chiusa. Per far entrare qualcun altro serve prima
            annullarla.
          </p>
        </Card.Body>
      </Card>
    )
  }

  return (
    <Card>
      <Card.Body>
        <h2 className="h5">Inviti</h2>
        {!active && (
          <>
            <p className="text-body-secondary">
              Ogni codice vale per una persona e dura 3 minuti: conviene generarlo quando sai di
              poterlo girare subito.
            </p>
            {invite && (
              <p className="small text-danger">
                Il codice {invite.code} è scaduto. Ne generiamo un altro?
              </p>
            )}
            <div className="d-grid d-sm-flex">
              <Button onClick={generate} disabled={create.isPending}>
                {create.isPending && <Spinner animation="border" size="sm" className="me-2" />}
                {invite ? 'Genera un nuovo codice' : 'Genera un codice di invito'}
              </Button>
            </div>
          </>
        )}

        {active && invite && (
          <>
            <div className="text-center py-2">
              <div className="ss-code" aria-label={`Codice ${invite.code.split('').join(' ')}`}>
                {invite.code}
              </div>
              <div className="small text-body-secondary mb-2" aria-live="polite">
                Valido ancora {formatSeconds(secondsLeft)}
              </div>
              <ProgressBar
                now={(secondsLeft / (invite.expires_in || TOTAL_SECONDS)) * 100}
                variant={secondsLeft > 30 ? 'secondary' : 'primary'}
                style={{ height: '0.375rem' }}
                aria-hidden
              />
            </div>
            <div className="ss-actions mt-3">
              {canShare && <Button onClick={share}>Condividi l'invito</Button>}
              <Button variant={canShare ? 'outline-secondary' : 'primary'} onClick={() => copy('link')}>
                {copied === 'link' ? 'Link copiato' : 'Copia il link'}
              </Button>
              <Button variant="outline-secondary" onClick={() => copy('code')}>
                {copied === 'code' ? 'Codice copiato' : 'Copia solo il codice'}
              </Button>
            </div>
            <Button variant="link" className="px-0 mt-2" onClick={generate} disabled={create.isPending}>
              Serve un altro codice
            </Button>
          </>
        )}
        <ErrorAlert error={create.error} className="mt-3 mb-0" />
      </Card.Body>
    </Card>
  )
}
