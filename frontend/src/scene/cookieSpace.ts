import { Vector3 } from 'three'

// Dalla sagoma SVG (0–100 × 0–120, y verso il basso) alle unità della scena, con i piedi a y=0.
export const SCALE = 0.0105
export const BEVEL = 3
export const DEPTH = 12
export const FOOT = 112 + BEVEL
/** Faccia anteriore del biscotto (dove sta la glassa). */
export const FRONT_Z = (DEPTH / 2 + BEVEL) * SCALE + 0.004

export function toScene(x: number, y: number, z = FRONT_Z): Vector3 {
  return new Vector3((x - 50) * SCALE, (FOOT - y) * SCALE, z)
}
