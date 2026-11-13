import { useState, type ReactNode } from 'react'
import { Alert, Modal, Spinner } from 'react-bootstrap'
import { Button } from './Button'
import { errorMessage } from '../api/client'

export function Loading({ label = 'Un attimo…' }: { label?: string }) {
  return (
    <div className="d-flex align-items-center justify-content-center gap-2 py-5 text-body-secondary">
      <Spinner animation="border" size="sm" role="status" />
      <span>{label}</span>
    </div>
  )
}

export function ErrorAlert({ error, className }: { error: unknown; className?: string }) {
  if (!error) return null
  return (
    <Alert variant="danger" className={className}>
      {errorMessage(error)}
    </Alert>
  )
}

interface ConfirmProps {
  title: string
  children: ReactNode
  confirmLabel: string
  cancelLabel?: string
  variant?: string
  onConfirm: () => Promise<unknown>
  trigger: (open: () => void) => ReactNode
}

/** Bottone + modale di conferma per le azioni che non si possono annullare al volo. */
export function Confirm({
  title,
  children,
  confirmLabel,
  cancelLabel = 'Lasciamo stare',
  variant = 'primary',
  onConfirm,
  trigger,
}: ConfirmProps) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<unknown>(null)

  const close = () => {
    if (busy) return
    setOpen(false)
    setError(null)
  }

  const confirm = async () => {
    setBusy(true)
    setError(null)
    try {
      await onConfirm()
      setOpen(false)
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      {trigger(() => setOpen(true))}
      <Modal show={open} onHide={close} centered>
        <Modal.Header closeButton>
          <Modal.Title as="h2" className="h5 mb-0">
            {title}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {children}
          <ErrorAlert error={error} className="mt-3 mb-0" />
        </Modal.Body>
        <Modal.Footer className="ss-actions justify-content-end">
          <Button variant="outline-secondary" onClick={close} disabled={busy}>
            {cancelLabel}
          </Button>
          <Button variant={variant} onClick={confirm} disabled={busy}>
            {busy && <Spinner animation="border" size="sm" className="me-2" />}
            {confirmLabel}
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  )
}
