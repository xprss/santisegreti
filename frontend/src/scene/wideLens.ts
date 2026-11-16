import { events as createPointerEvents, type RootState } from '@react-three/fiber'
import { Effect } from 'postprocessing'
import { Uniform } from 'three'

/**
 * Distorsione a botte del grandangolo: il centro si ingrandisce, i bordi si comprimono e le linee
 * dritte ai lati si curvano. 0 è un obiettivo perfetto.
 */
export const BARREL = 0.42

// Dal punto dello schermo al punto dell'immagine renderizzata. Gli angoli restano agli angoli
// (niente bordi neri), il centro è ingrandito di 1 + strength. Il raggio è misurato sul riquadro
// normalizzato, così la curvatura si vede ai lati anche col telefono in verticale.
const fragmentShader = /* glsl */ `
uniform float strength;

void mainUv(inout vec2 uv) {
  vec2 p = uv * 2.0 - 1.0;
  float r2 = dot(p, p) * 0.5;
  p *= (1.0 + strength * r2) / (1.0 + strength);
  uv = p * 0.5 + 0.5;
}
`

export class BarrelEffect extends Effect {
  constructor({ strength = BARREL }: { strength?: number } = {}) {
    super('BarrelEffect', fragmentShader, {
      uniforms: new Map([['strength', new Uniform(strength)]]),
    })
  }
}

/** La stessa trasformazione, in coordinate NDC (-1…1). */
export function screenToScene(x: number, y: number, strength = BARREL): [number, number] {
  const f = (1 + strength * (x * x + y * y) * 0.5) / (1 + strength)
  return [x * f, y * f]
}

/**
 * Eventi del puntatore che tengono conto della distorsione: senza, toccando un omino curvato ai lati
 * il raggio partirebbe da dove l'omino sarebbe senza obiettivo, e lo mancherebbe.
 */
export function wideLensEvents(store: Parameters<typeof createPointerEvents>[0]) {
  const events = createPointerEvents(store)
  return {
    ...events,
    compute(event: { offsetX: number; offsetY: number }, state: RootState) {
      const x = (event.offsetX / state.size.width) * 2 - 1
      const y = -(event.offsetY / state.size.height) * 2 + 1
      state.pointer.set(...screenToScene(x, y))
      state.raycaster.setFromCamera(state.pointer, state.camera)
    },
  }
}
