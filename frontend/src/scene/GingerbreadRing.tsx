import { useFrame, type ThreeEvent } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import {
  BufferGeometry,
  Color,
  CatmullRomCurve3,
  ExtrudeGeometry,
  Group,
  QuadraticBezierCurve3,
  SphereGeometry,
  TubeGeometry,
  Vector3,
} from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader.js'
import type { UserPublic } from '../api/types'
import { GINGERBREAD_PATH } from '../components/Gingerbread'
import { ringRadius } from './layout'
import { hashString, seeded } from './random'

// Dalla sagoma SVG (0–100 × 0–120, y verso il basso) alle unità della scena.
const SCALE = 0.0105
const BEVEL = 3
const DEPTH = 12
const FOOT = 112 + BEVEL
const FRONT_Z = ((DEPTH / 2 + BEVEL) * SCALE) + 0.004

function toScene(x: number, y: number): Vector3 {
  return new Vector3((x - 50) * SCALE, (FOOT - y) * SCALE, FRONT_Z)
}

function buildGeometries() {
  const svg = new SVGLoader().parse(
    `<svg xmlns="http://www.w3.org/2000/svg"><path d="${GINGERBREAD_PATH}"/></svg>`,
  )
  const shapes = svg.paths[0].toShapes()
  const cookie = new ExtrudeGeometry(shapes, {
    depth: DEPTH,
    bevelEnabled: true,
    bevelThickness: BEVEL,
    bevelSize: BEVEL,
    bevelSegments: 3,
    curveSegments: 10,
  })
  // Asse y verso l'alto e piedi a quota zero. Invertendo due assi la geometria non si rovescia.
  cookie.translate(-50, -FOOT, -DEPTH / 2)
  cookie.scale(SCALE, -SCALE, -SCALE)
  cookie.computeVertexNormals()

  const tube = (points: [number, number][]) =>
    new TubeGeometry(new CatmullRomCurve3(points.map(([x, y]) => toScene(x, y)), false, 'catmullrom', 0.1), 20, 0.016, 5)
  const dot = (x: number, y: number, radius: number) => {
    const sphere = new SphereGeometry(radius, 10, 8)
    const p = toScene(x, y)
    sphere.translate(p.x, p.y, p.z - radius * 0.35)
    return sphere
  }

  const icing = mergeGeometries([
    tube([[17, 47], [20, 51], [17, 55], [20, 59]]),
    tube([[83, 47], [80, 51], [83, 55], [80, 59]]),
    tube([[24, 99], [28, 102], [32, 99], [36, 102]]),
    tube([[64, 99], [68, 102], [72, 99], [76, 102]]),
    new TubeGeometry(new QuadraticBezierCurve3(toScene(42, 31), toScene(50, 37), toScene(58, 31)), 16, 0.016, 5),
    dot(50, 52, 0.038),
    dot(50, 64, 0.038),
    dot(50, 76, 0.038),
  ]) as BufferGeometry

  const eyes = mergeGeometries([dot(43, 22, 0.034), dot(57, 22, 0.034)]) as BufferGeometry
  return { cookie, icing, eyes }
}

interface Props {
  participants: UserPublic[]
  meId: string
  animate: boolean
  selectedId: string | null
  highlightedId: string | null
  onSelect: (id: string | null) => void
  onHover: (id: string | null) => void
}

export function GingerbreadRing({
  participants,
  meId,
  animate,
  selectedId,
  highlightedId,
  onSelect,
  onHover,
}: Props) {
  const geometries = useMemo(() => buildGeometries(), [])
  const radius = ringRadius(participants.length)

  // Tu per primo, davanti alla camera; gli altri in ordine di arrivo.
  const ordered = useMemo(() => {
    const index = participants.findIndex((p) => p.id === meId)
    return index <= 0 ? participants : [...participants.slice(index), ...participants.slice(0, index)]
  }, [participants, meId])

  return (
    <group>
      {ordered.map((person, i) => {
        const angle = (i / ordered.length) * Math.PI * 2
        return (
          <Cookie
            key={person.id}
            person={person}
            isMe={person.id === meId}
            angle={angle}
            radius={radius}
            geometries={geometries}
            animate={animate}
            highlighted={highlightedId === person.id}
            onHover={(over) => onHover(over ? person.id : null)}
            onSelect={() => onSelect(selectedId === person.id ? null : person.id)}
          />
        )
      })}
    </group>
  )
}

interface CookieProps {
  person: UserPublic
  isMe: boolean
  angle: number
  radius: number
  geometries: ReturnType<typeof buildGeometries>
  animate: boolean
  highlighted: boolean
  onHover: (over: boolean) => void
  onSelect: () => void
}

function Cookie({
  person,
  isMe,
  angle,
  radius,
  geometries,
  animate,
  highlighted,
  onHover,
  onSelect,
}: CookieProps) {
  const body = useRef<Group>(null)
  const color = useMemo(() => new Color(person.color), [person.color])
  const motionRef = useRef<{ phase: number; nextHop: number; hopEvery: number } | null>(null)

  useFrame(({ clock }) => {
    const group = body.current
    if (!group || !animate) return
    if (!motionRef.current) {
      const rand = seeded(hashString(person.id))
      motionRef.current = {
        phase: rand() * Math.PI * 2,
        nextHop: 2 + rand() * 8,
        hopEvery: 7 + rand() * 7,
      }
    }
    const motion = motionRef.current
    const t = clock.elapsedTime
    group.rotation.z = Math.sin(t * 1.3 + motion.phase) * 0.06
    let lift = 0
    const sinceHop = t - motion.nextHop
    if (sinceHop > 0.45) motion.nextHop = t + motion.hopEvery
    else if (sinceHop > 0) lift = Math.sin((sinceHop / 0.45) * Math.PI) * 0.28
    group.position.y = lift
  })

  const pointer = {
    onPointerOver: (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation()
      if (e.pointerType === 'mouse') onHover(true)
      document.body.style.cursor = 'pointer'
    },
    onPointerOut: () => {
      onHover(false)
      document.body.style.cursor = ''
    },
    onClick: (e: ThreeEvent<MouseEvent>) => {
      e.stopPropagation()
      onSelect()
    },
  }

  return (
    <group position={[Math.sin(angle) * radius, 0, Math.cos(angle) * radius]} rotation={[0, angle, 0]}>
      {(isMe || highlighted) && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.015, 0]}>
          <ringGeometry args={highlighted ? [0.5, 0.62, 40] : [0.42, 0.52, 40]} />
          <meshBasicMaterial
            color={highlighted ? '#fffaf0' : '#e8c04a'}
            toneMapped={false}
            transparent
            opacity={0.9}
          />
        </mesh>
      )}
      <group ref={body}>
        <mesh geometry={geometries.cookie} {...pointer}>
          <meshStandardMaterial color={color} roughness={0.72} />
        </mesh>
        <mesh geometry={geometries.icing}>
          <meshStandardMaterial color="#fffaf0" roughness={0.45} emissive="#3a3020" />
        </mesh>
        <mesh geometry={geometries.eyes}>
          <meshStandardMaterial color="#2a1c14" roughness={0.3} />
        </mesh>
      </group>
    </group>
  )
}
