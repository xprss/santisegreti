import { useState, type CSSProperties, type FormEvent } from 'react'
import { Alert, Container, Form, Spinner } from 'react-bootstrap'
import { accessoryLabel, type AccessoryId } from '../accessories/catalog'
import { useMe, useUpdateMe } from '../api/hooks'
import type { Me } from '../api/types'
import { AccessoryPicker } from '../components/AccessoryPicker'
import { Button } from '../components/Button'
import { ErrorAlert } from '../components/feedback'
import { Gingerbread } from '../components/Gingerbread'
import { PALETTE } from '../lib/format'

const BIO_MAX = 280

/**
 * Il profilo nello stile della stanza: la tua polaroid in alto, poi bigliettini appesi con lo
 * scotch per nome e bio, colore e accessorio. L'anteprima cambia mentre scegli.
 */
export function Profile() {
  const me = useMe().data as Me
  const update = useUpdateMe()
  const [name, setName] = useState(me.name)
  const [bio, setBio] = useState(me.bio)
  const [color, setColor] = useState(me.color.toUpperCase())
  const [accessory, setAccessory] = useState<AccessoryId | null>(me.accessory)
  const [saved, setSaved] = useState(false)

  const submit = (event: FormEvent) => {
    event.preventDefault()
    setSaved(false)
    update.mutate(
      { name: name.trim(), bio: bio.trim(), color, accessory },
      { onSuccess: () => setSaved(true) },
    )
  }

  return (
    <Container className="ss-page ss-narrow">
      <h1 className="visually-hidden">Il tuo profilo</h1>

      <div className="ss-polaroid ss-polaroid--hero" style={{ '--tilt': '-2.5deg' } as CSSProperties}>
        <span className="ss-polaroid-photo" style={{ '--tint': color } as CSSProperties}>
          <Gingerbread
            color={color}
            accessory={accessory}
            size={150}
            title={`Il tuo omino: ${accessoryLabel(accessory).toLowerCase()}`}
          />
        </span>
        <span className="ss-polaroid-name">{name.trim() || 'Senza nome'}</span>
      </div>

      <Form onSubmit={submit} className="ss-stickers">
        <div className="ss-sticker" style={{ '--tilt': '1.2deg' } as CSSProperties}>
          <Form.Group className="mb-3" controlId="profile-name">
            <Form.Label className="ss-sticker-caption">come ti chiami</Form.Label>
            <Form.Control
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={40}
              required
            />
          </Form.Group>
          <Form.Group controlId="profile-bio">
            <Form.Label className="ss-sticker-caption">qualcosa di te</Form.Label>
            <Form.Control
              as="textarea"
              rows={3}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              maxLength={BIO_MAX}
              placeholder="Bevo solo tè, colleziono tazze, ho il pollice nero con le piante…"
            />
            <div className="small text-end mt-1 opacity-75">
              {bio.length}/{BIO_MAX}
            </div>
          </Form.Group>
        </div>

        <fieldset className="ss-sticker ss-sticker--gold" style={{ '--tilt': '-1.5deg' } as CSSProperties}>
          <legend className="ss-sticker-caption">il tuo colore</legend>
          <div className="d-flex flex-wrap justify-content-center gap-2 mb-3">
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
          <Form.Group
            controlId="profile-color"
            className="d-flex align-items-center justify-content-center gap-2"
          >
            <Form.Control
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value.toUpperCase())}
              title="Un colore qualsiasi"
            />
            <Form.Label className="mb-0">oppure uno qualsiasi</Form.Label>
          </Form.Group>
        </fieldset>

        <fieldset className="ss-sticker ss-sticker--green" style={{ '--tilt': '1deg' } as CSSProperties}>
          <legend className="ss-sticker-caption">un accessorio, se ti va</legend>
          <AccessoryPicker value={accessory} color={color} onChange={setAccessory} />
        </fieldset>

        <ErrorAlert error={update.error} className="mb-0" />
        {saved && (
          <Alert variant="light" className="mb-0 text-center fw-bold" onClose={() => setSaved(false)} dismissible>
            Fatto! Il tuo omino è aggiornato.
          </Alert>
        )}

        <div className="text-center">
          <Button type="submit" variant="warning" size="lg" disabled={update.isPending}>
            {update.isPending && <Spinner animation="border" size="sm" className="me-2" />}
            Salva il profilo
          </Button>
        </div>
      </Form>
    </Container>
  )
}
