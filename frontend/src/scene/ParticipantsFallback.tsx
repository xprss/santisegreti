import type { UserPublic } from '../api/types'
import { Gingerbread } from '../components/Gingerbread'
import { Logo } from '../components/Logo'

interface Props {
  participants: UserPublic[]
  meId: string
}

/** Versione 2D della scena: per chi non ha WebGL e mentre la scena 3D si carica. */
export function ParticipantsFallback({ participants, meId }: Props) {
  return (
    <div className="position-absolute top-0 start-0 w-100 h-100 d-flex flex-column align-items-center justify-content-center gap-3 p-3 text-cream">
      <Logo size={64} />
      <div className="d-flex flex-wrap justify-content-center gap-2">
        {participants.map((person) => (
          <div key={person.id} className="text-center" style={{ width: '4.5rem' }}>
            <Gingerbread color={person.color} size={40} title={person.name} />
            <div className="small text-truncate">
              {person.id === meId ? 'Tu' : person.name}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
