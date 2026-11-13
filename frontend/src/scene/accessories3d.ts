import {
  BufferGeometry,
  CatmullRomCurve3,
  ExtrudeGeometry,
  TorusGeometry,
  TubeGeometry,
} from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader.js'
import {
  ACCESSORY_BY_ID,
  type AccessoryId,
  type AccessoryPart,
  type PartLayer,
} from '../accessories/catalog'
import { FOOT, FRONT_Z, SCALE, toScene } from './cookieSpace'

export interface AccessoryMesh {
  geometry: BufferGeometry
  color: string
  metal: boolean
  glow: boolean
  opacity: number
}

const loader = new SVGLoader()
const cache = new Map<AccessoryId, AccessoryMesh[]>()

function parse(d: string) {
  return loader.parse(`<svg xmlns="http://www.w3.org/2000/svg"><path d="${d}"/></svg>`).paths[0]
}

/** Porta la parte alla sua profondità: sul davanti, attorno o dietro al biscotto. */
function place(geometry: BufferGeometry, layer: PartLayer, order: number) {
  geometry.computeBoundingBox()
  const box = geometry.boundingBox!
  if (layer === 'front') {
    // Un filo sopra la glassa; ogni parte successiva un filo più avanti, niente z-fighting.
    geometry.translate(0, 0, FRONT_Z + 0.012 + order * 0.003 - box.min.z)
  } else if (layer === 'back') {
    geometry.translate(0, 0, -FRONT_Z - 0.004 - box.max.z)
  } else {
    geometry.translate(0, 0, -(box.min.z + box.max.z) / 2)
  }
  return geometry
}

function fillGeometry(part: AccessoryPart, order: number) {
  const geometry = new ExtrudeGeometry(parse(part.d).toShapes(), {
    depth: part.depth ?? 3,
    bevelEnabled: true,
    bevelThickness: 0.6,
    bevelSize: 0.5,
    bevelSegments: 1,
    curveSegments: 10,
  })
  // Stessa trasformazione del biscotto: y verso l'alto, due assi invertiti per non rovesciarla.
  geometry.translate(-50, -FOOT, 0)
  geometry.scale(SCALE, -SCALE, -SCALE)
  return place(geometry, part.layer, order)
}

function strokeGeometry(part: AccessoryPart, order: number) {
  const radius = ((part.width ?? 2) / 2) * SCALE
  const tubes = parse(part.d).subPaths.map((sub) => {
    let points = sub.getPoints(16).map((p) => toScene(p.x, p.y, 0))
    const closed = points.length > 2 && points[0].distanceTo(points[points.length - 1]) < 1e-3
    if (closed) points = points.slice(0, -1)
    points = points.filter((p, i) => i === 0 || p.distanceTo(points[i - 1]) > 1e-4)
    const curve = new CatmullRomCurve3(points, closed, 'centripetal')
    return new TubeGeometry(curve, Math.max(12, points.length * 4), radius, 6, closed)
  })
  const merged = tubes.length === 1 ? tubes[0] : mergeGeometries(tubes)
  return place(merged, part.layer, order)
}

/** L'aureola sta in orizzontale sopra la testa: in 3D non basta l'ellisse vista di fronte. */
function haloGeometry() {
  const geometry = new TorusGeometry(0.16, 0.017, 8, 48)
  geometry.rotateX(Math.PI / 2)
  geometry.translate(0, (FOOT + 6) * SCALE, 0)
  return geometry
}

export function accessoryMeshes(id: AccessoryId): AccessoryMesh[] {
  const cached = cache.get(id)
  if (cached) return cached
  const accessory = ACCESSORY_BY_ID.get(id)
  if (!accessory) return []

  const meshes = accessory.parts.map((part, order) => ({
    geometry:
      id === 'halo'
        ? haloGeometry()
        : part.kind === 'fill'
          ? fillGeometry(part, order)
          : strokeGeometry(part, order),
    color: part.color,
    metal: part.metal ?? false,
    glow: part.glow ?? false,
    opacity: part.opacity ?? 1,
  }))
  cache.set(id, meshes)
  return meshes
}
