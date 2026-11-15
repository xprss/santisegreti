import { useLayoutEffect, useMemo, useRef } from 'react'
import {
  AdditiveBlending,
  BufferGeometry,
  CanvasTexture,
  CatmullRomCurve3,
  Color,
  ConeGeometry,
  CylinderGeometry,
  ExtrudeGeometry,
  Float32BufferAttribute,
  InstancedMesh,
  Object3D,
  RepeatWrapping,
  Shape,
  SRGBColorSpace,
  TubeGeometry,
  Vector3,
} from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { glowTexture } from './glow'
import { seeded } from './random'
import { Reindeer, type ReindeerPose } from './Reindeer'
import { Snowman, type SnowmanLook } from './Snowman'

/** Pupazzi di neve sparsi ai margini del bosco, ognuno con la sua sciarpa e il suo cappello. */
const SNOWMEN: ({ angle: number; distance: number; size: number } & SnowmanLook)[] = [
  { angle: 0.3, distance: 20.5, size: 1.7, scarf: '#c81f2d', hat: 'top', hatColor: '#c81f2d' },
  { angle: 1.6, distance: 21, size: 1.5, scarf: '#1e5b3a', hat: 'beanie', hatColor: '#c81f2d' },
  { angle: 2.85, distance: 20.5, size: 1.8, scarf: '#2a4f8a', hat: 'top', hatColor: '#e8c04a' },
  { angle: 4.05, distance: 21, size: 1.6, scarf: '#e8c04a', hat: 'beanie', hatColor: '#2a4f8a' },
  { angle: 5.15, distance: 20.5, size: 1.55, scarf: '#c81f2d', hat: 'beanie', hatColor: '#1e5b3a' },
]

/** Due piccoli branchi di renne che brucano tra le casette. */
const HERD: { angle: number; distance: number; heading: number; pose: ReindeerPose }[] = [
  { angle: 1.22, distance: 20.5, heading: 0.4, pose: 'graze' },
  { angle: 1.34, distance: 21.8, heading: 2.6, pose: 'stand' },
  { angle: 1.1, distance: 22.2, heading: -1.2, pose: 'stand' },
  { angle: 3.95, distance: 21, heading: 1.8, pose: 'stand' },
  { angle: 4.1, distance: 20.3, heading: -0.6, pose: 'graze' },
  { angle: 5.95, distance: 20.8, heading: 3.4, pose: 'stand' },
]

const polar = (angle: number, distance: number) =>
  [Math.sin(angle) * distance, 0, Math.cos(angle) * distance] as const

/** Radure nel bosco: lì non crescono abeti. */
const CLEARINGS: { x: number; z: number; r: number }[] = []

function paint(geometry: BufferGeometry, color: string): BufferGeometry {
  const g = geometry.index ? geometry.toNonIndexed() : geometry
  const c = new Color(color)
  const colors = new Float32Array(g.getAttribute('position').count * 3)
  for (let i = 0; i < colors.length; i += 3) colors.set([c.r, c.g, c.b], i)
  g.setAttribute('color', new Float32BufferAttribute(colors, 3))
  return g
}

/** Un abete innevato low-poly, in un'unica geometria colorata per vertice. */
function pineGeometry(): BufferGeometry {
  const parts: BufferGeometry[] = []
  const trunk = new CylinderGeometry(0.1, 0.14, 0.5, 5)
  trunk.translate(0, 0.25, 0)
  parts.push(paint(trunk, '#3b2617'))
  const tiers = [
    { y: 0.35, r: 0.95, h: 1.3 },
    { y: 0.95, r: 0.75, h: 1.15 },
    { y: 1.5, r: 0.52, h: 1.0 },
  ]
  for (const { y, r, h } of tiers) {
    const cone = new ConeGeometry(r, h, 7)
    cone.translate(0, y + h / 2, 0)
    parts.push(paint(cone, '#123a26'))
    // La neve copre la parte alta di ogni palco: stesso apice, cono un filo più largo.
    const cap = new ConeGeometry(r * 0.5 * 1.04, h * 0.5, 7)
    cap.translate(0, y + h - (h * 0.5) / 2 + 0.01, 0)
    parts.push(paint(cap, '#eef4fa'))
  }
  const merged = mergeGeometries(parts) as BufferGeometry
  merged.computeVertexNormals()
  return merged
}

/** Strisce diagonali rosse e bianche: avvolte su un tubo diventano la spirale del bastoncino. */
function stripeTexture() {
  const size = 64
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#fffdf8'
  ctx.fillRect(0, 0, size, size)
  ctx.fillStyle = '#d62b37'
  for (let x = -size; x < size * 2; x += size / 2) {
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x + size / 4, 0)
    ctx.lineTo(x + size / 4 + size, size)
    ctx.lineTo(x + size, size)
    ctx.fill()
  }
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  texture.wrapS = texture.wrapT = RepeatWrapping
  texture.repeat.set(10, 1)
  return texture
}

function candyCaneGeometry() {
  const points: Vector3[] = [new Vector3(0, 0, 0), new Vector3(0, 0.45, 0)]
  for (let i = 0; i <= 10; i++) {
    const a = Math.PI - (i / 10) * Math.PI
    points.push(new Vector3(0.17 + Math.cos(a) * 0.17, 0.9 + Math.sin(a) * 0.17, 0))
  }
  points.push(new Vector3(0.34, 0.78, 0))
  return new TubeGeometry(new CatmullRomCurve3(points, false, 'centripetal'), 48, 0.05, 8)
}

const dummy = new Object3D()
const ROOF_PITCH = Math.atan2(0.8, 1)

let gable: BufferGeometry | null = null
function gableGeometry(): BufferGeometry {
  if (gable) return gable
  const shape = new Shape()
  shape.moveTo(-1, 0)
  shape.lineTo(1, 0)
  shape.lineTo(0, 0.8)
  shape.closePath()
  gable = new ExtrudeGeometry(shape, { depth: 1.5, bevelEnabled: false })
  gable.translate(0, 0, -0.75)
  return gable
}

interface Cottage {
  angle: number
  distance: number
  scale: number
}

const COTTAGES: Cottage[] = [
  { angle: 0.9, distance: 24, scale: 1.25 },
  { angle: 2.25, distance: 27, scale: 1.0 },
  { angle: 3.4, distance: 23, scale: 1.15 },
  { angle: 4.6, distance: 26, scale: 1.3 },
  { angle: 5.6, distance: 25, scale: 0.95 },
]

for (const c of COTTAGES) CLEARINGS.push({ x: Math.sin(c.angle) * c.distance, z: Math.cos(c.angle) * c.distance, r: 3.2 })
for (const s of SNOWMEN) CLEARINGS.push({ x: Math.sin(s.angle) * s.distance, z: Math.cos(s.angle) * s.distance, r: 1.6 })
for (const d of HERD) CLEARINGS.push({ x: Math.sin(d.angle) * d.distance, z: Math.cos(d.angle) * d.distance, r: 1.8 })

/** Casetta con il tetto innevato e le finestre accese. */
function House({ angle, distance, scale }: Cottage) {
  const x = Math.sin(angle) * distance
  const z = Math.cos(angle) * distance
  const litWindow = (wx: number, wy: number) => (
    <group position={[wx, wy, 0.751]}>
      <mesh>
        <planeGeometry args={[0.32, 0.36]} />
        <meshBasicMaterial color="#ffb24d" toneMapped={false} />
      </mesh>
      <sprite scale={1.4} position={[0, 0, 0.05]}>
        <spriteMaterial
          map={glowTexture()}
          color="#ff9a3c"
          transparent
          opacity={0.6}
          depthWrite={false}
          blending={AdditiveBlending}
        />
      </sprite>
    </group>
  )
  return (
    <group position={[x, 0, z]} rotation={[0, angle + Math.PI, 0]} scale={scale}>
      <mesh position={[0, 0.6, 0]}>
        <boxGeometry args={[2, 1.2, 1.5]} />
        <meshStandardMaterial color="#7a4a2c" roughness={0.9} flatShading />
      </mesh>
      {/* timpano in legno e due falde coperte di neve */}
      <mesh geometry={gableGeometry()} position={[0, 1.2, 0]}>
        <meshStandardMaterial color="#6a3f25" roughness={0.9} flatShading />
      </mesh>
      {[-1, 1].map((side) => (
        <mesh
          key={side}
          position={[side * 0.52, 1.64, 0]}
          rotation={[0, 0, -side * ROOF_PITCH]}
        >
          <boxGeometry args={[1.5, 0.16, 1.85]} />
          <meshStandardMaterial color="#f2f6fb" roughness={1} flatShading />
        </mesh>
      ))}
      <mesh position={[0.55, 1.95, -0.2]}>
        <boxGeometry args={[0.26, 0.6, 0.26]} />
        <meshStandardMaterial color="#5a3322" roughness={0.9} flatShading />
      </mesh>
      {litWindow(-0.55, 0.7)}
      {litWindow(0.55, 0.7)}
      <mesh position={[0, 0.38, 0.752]}>
        <planeGeometry args={[0.36, 0.72]} />
        <meshStandardMaterial color="#3a2014" roughness={0.8} />
      </mesh>
    </group>
  )
}

/**
 * Il paesaggio intorno: colline innevate, un bosco di abeti, un villaggio con le luci accese
 * e bastoncini di zucchero giganti piantati tra gli alberi. Con tanti omini la camera si allontana,
 * e il paesaggio si allarga con lei (`scale`) per non finirle davanti.
 */
export function Landscape({ rich, scale, animate }: { rich: boolean; scale: number; animate: boolean }) {
  const pine = useMemo(() => pineGeometry(), [])
  const forest = useRef<InstancedMesh>(null)
  const count = rich ? 150 : 90

  const hills = useMemo(() => {
    const rand = seeded(5150)
    return Array.from({ length: 14 }, (_, i) => {
      const angle = (i / 14) * Math.PI * 2 + rand() * 0.3
      const distance = 40 + rand() * 9
      return {
        position: [Math.sin(angle) * distance, -1.5, Math.cos(angle) * distance] as const,
        scale: [11 + rand() * 7, 4 + rand() * 5, 8 + rand() * 4] as const,
        rotation: angle,
      }
    })
  }, [])

  const cane = useMemo(() => candyCaneGeometry(), [])
  const stripes = useMemo(() => stripeTexture(), [])
  const canes = useMemo(() => {
    const rand = seeded(1606)
    return Array.from({ length: 8 }, (_, i) => {
      const angle = ((i + 0.2 + rand() * 0.6) / 8) * Math.PI * 2
      return {
        angle,
        distance: 19 + rand() * 3,
        tilt: (rand() - 0.5) * 0.3,
        size: 2.6 + rand() * 1.2,
      }
    })
  }, [])

  useLayoutEffect(() => {
    const mesh = forest.current
    if (!mesh) return
    const rand = seeded(8086)
    let placed = 0
    let attempts = 0
    while (placed < count && attempts < count * 20) {
      attempts++
      const angle = rand() * Math.PI * 2
      const distance = 20 + Math.pow(rand(), 0.7) * 16
      const x = Math.sin(angle) * distance
      const z = Math.cos(angle) * distance
      // Lascia spazio attorno alle casette.
      if (CLEARINGS.some((c) => Math.hypot(c.x - x, c.z - z) < c.r)) continue
      const s = 1.1 + rand() * 1.4 + (distance - 20) * 0.04
      dummy.position.set(x, 0, z)
      dummy.rotation.set(0, rand() * Math.PI, 0)
      dummy.scale.set(s, s * (0.9 + rand() * 0.35), s)
      dummy.updateMatrix()
      mesh.setMatrixAt(placed, dummy.matrix)
      placed++
    }
    mesh.count = placed
    mesh.instanceMatrix.needsUpdate = true
    mesh.computeBoundingSphere()
  }, [count])

  return (
    <group scale={scale}>
      {hills.map((hill, i) => (
        <mesh key={i} position={hill.position} scale={hill.scale} rotation={[0, hill.rotation, 0]}>
          <icosahedronGeometry args={[1, 2]} />
          <meshStandardMaterial color="#dbe6f2" roughness={1} flatShading />
        </mesh>
      ))}

      <instancedMesh ref={forest} args={[pine, undefined, count]} castShadow>
        <meshStandardMaterial vertexColors flatShading roughness={0.9} />
      </instancedMesh>

      {COTTAGES.map((cottage, i) => (
        <House key={i} {...cottage} />
      ))}

      {SNOWMEN.map(({ angle, distance, size, ...look }, i) => (
        <group key={i} position={polar(angle, distance)} rotation={[0, angle + Math.PI, 0]} scale={size}>
          <Snowman {...look} />
        </group>
      ))}

      {HERD.map((deer, i) => (
        <group key={i} position={polar(deer.angle, deer.distance)} rotation={[0, deer.heading, 0]} scale={2}>
          <Reindeer pose={deer.pose} animate={animate} phase={i * 2.3} />
        </group>
      ))}

      {canes.map((c, i) => (
        <mesh
          key={i}
          geometry={cane}
          position={[Math.sin(c.angle) * c.distance, -0.1, Math.cos(c.angle) * c.distance]}
          rotation={[0, c.angle + Math.PI / 2, c.tilt]}
          scale={c.size}
        >
          <meshStandardMaterial map={stripes} roughness={0.35} />
        </mesh>
      ))}
    </group>
  )
}
