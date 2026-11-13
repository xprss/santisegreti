import { Fragment } from 'react'
import {
  ACCESSORIES,
  ACCESSORY_GROUPS,
  accessoryLabel,
  type AccessoryId,
} from '../accessories/catalog'
import { Gingerbread } from './Gingerbread'

interface Props {
  value: AccessoryId | null
  color: string
  onChange: (value: AccessoryId | null) => void
}

/**
 * Scelta dell'accessorio: radio nativi (uno e uno solo, frecce da tastiera incluse) con l'omino
 * già vestito come anteprima.
 */
export function AccessoryPicker({ value, color, onChange }: Props) {
  const tile = (id: AccessoryId | null) => {
    const inputId = `accessory-${id ?? 'none'}`
    return (
      <div key={inputId} className="col">
        <input
          type="radio"
          className="btn-check"
          name="accessory"
          id={inputId}
          checked={value === id}
          onChange={() => onChange(id)}
        />
        <label className="ss-accessory-tile" htmlFor={inputId}>
          <Gingerbread color={color} accessory={id} size={52} />
          <span>{id ? accessoryLabel(id) : 'Niente'}</span>
        </label>
      </div>
    )
  }

  return (
    <div role="radiogroup" aria-label="Accessorio dell'omino">
      <div className="row row-cols-3 row-cols-sm-4 row-cols-md-5 g-2 mb-1">{tile(null)}</div>
      {ACCESSORY_GROUPS.map((group) => (
        <Fragment key={group.id}>
          <div className="small fw-semibold text-body-secondary mt-3 mb-2">{group.label}</div>
          <div className="row row-cols-3 row-cols-sm-4 row-cols-md-5 g-2">
            {ACCESSORIES.filter((a) => a.group === group.id).map((a) => tile(a.id))}
          </div>
        </Fragment>
      ))}
    </div>
  )
}
