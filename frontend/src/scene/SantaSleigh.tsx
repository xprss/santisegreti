import { useFrame, useThree } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import {
  AdditiveBlending,
  BufferGeometry,
  CatmullRomCurve3,
  ExtrudeGeometry,
  Group,
  MathUtils,
  PerspectiveCamera,
  Shape,
  Sprite,
  TubeGeometry,
  Vector3,
} from 'three'
import { glowTexture } from './glow'
import { Reindeer } from './Reindeer'

/** Ogni quanto passa la slitta e quanto ci mette ad attraversare il cielo (secondi). */
const PERIOD = 18
const CROSSING = 13
const DEPTH = 38
const TRAIL = 16

/** Due coppie di renne e Rudolph in testa, davanti alla slitta. */
const TEAM: { x: number; z: number; rudolph?: boolean }[] = [
  { x: 2.0, z: 0.32 },
  { x: 2.0, z: -0.32 },
  { x: 3.25, z: 0.32 },
  { x: 3.25, z: -0.32 },
  { x: 4.5, z: 0, rudolph: true },
]

function sleighBody() {
  // Profilo laterale con il ricciolo davanti e lo schienale alto dietro, estruso in larghezza.
  const shape = new Shape()
  shape.moveTo(-0.9, 0.3)
  shape.lineTo(0.5, 0.3)
  shape.quadraticCurveTo(1.0, 0.3, 1.0, 0.75)
  shape.quadraticCurveTo(1.0, 1.02, 0.78, 0.95)
  shape.lineTo(0.55, 0.65)
  shape.lineTo(-0.55, 0.65)
  shape.lineTo(-0.72, 1.15)
  shape.quadraticCurveTo(-0.95, 1.22, -0.95, 1.0)
  shape.closePath()
  const g = new ExtrudeGeometry(shape, {
    depth: 0.8,
    bevelEnabled: true,
    bevelThickness: 0.05,
    bevelSize: 0.04,
    bevelSegments: 2,
    curveSegments: 8,
  })
  g.translate(0, 0, -0.4)
  return g
}

function runner(z: number) {
  const points = [
    new Vector3(-1.0, 0.12, z),
    new Vector3(-0.9, 0.04, z),
    new Vector3(0.8, 0.04, z),
    new Vector3(1.15, 0.2, z),
    new Vector3(1.2, 0.42, z),
    new Vector3(1.08, 0.48, z),
  ]
  return new TubeGeometry(new CatmullRomCurve3(points, false, 'centripetal'), 40, 0.035, 6)
}

function Santa() {
  const red = <meshStandardMaterial color="#d42630" roughness={0.6} flatShading fog={false} />
  const white = <meshStandardMaterial color="#fffaf2" roughness={0.9} flatShading fog={false} />
  return (
    <group position={[-0.15, 0.65, 0]}>
      <mesh position={[0, 0.3, 0]} scale={[1, 1.1, 1]}>
        <sphereGeometry args={[0.32, 10, 8]} />
        {red}
      </mesh>
      <mesh position={[0, 0.22, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.31, 0.04, 5, 16]} />
        <meshStandardMaterial color="#1b1410" roughness={0.5} fog={false} />
      </mesh>
      <mesh position={[0.3, 0.22, 0]}>
        <boxGeometry args={[0.04, 0.09, 0.11]} />
        <meshStandardMaterial color="#e8c04a" metalness={0.8} roughness={0.3} fog={false} />
      </mesh>
      {/* braccia tese verso le redini */}
      {[1, -1].map((side) => (
        <group key={side} position={[0.05, 0.45, side * 0.25]} rotation={[0, 0, -1.2]}>
          <mesh position={[0, 0.18, 0]}>
            <cylinderGeometry args={[0.07, 0.08, 0.36, 6]} />
            {red}
          </mesh>
          <mesh position={[0, 0.38, 0]}>
            <sphereGeometry args={[0.065, 6, 5]} />
            <meshStandardMaterial color="#1b1410" roughness={0.6} fog={false} />
          </mesh>
        </group>
      ))}
      {/* testa, barba, cappello con pompon */}
      <mesh position={[0.02, 0.72, 0]}>
        <sphereGeometry args={[0.17, 10, 8]} />
        <meshStandardMaterial color="#f2c6a4" roughness={0.8} fog={false} />
      </mesh>
      <mesh position={[0.1, 0.62, 0]} scale={[0.9, 1.1, 1.05]}>
        <sphereGeometry args={[0.15, 8, 6]} />
        {white}
      </mesh>
      <mesh position={[0.19, 0.74, 0]}>
        <sphereGeometry args={[0.035, 6, 5]} />
        <meshStandardMaterial color="#e89a8a" roughness={0.7} fog={false} />
      </mesh>
      <group position={[0, 0.84, 0]} rotation={[0, 0, 0.45]}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.16, 0.045, 5, 14]} />
          {white}
        </mesh>
        <mesh position={[0, 0.2, 0]}>
          <coneGeometry args={[0.16, 0.4, 8]} />
          {red}
        </mesh>
        <mesh position={[0, 0.42, 0]}>
          <icosahedronGeometry args={[0.06, 1]} />
          {white}
        </mesh>
      </group>
    </group>
  )
}

/** La slitta con Babbo Natale, il sacco dei regali e cinque renne (Rudolph davanti). Guarda verso +x. */
function Team({ animate }: { animate: boolean }) {
  const body = useMemo(() => sleighBody(), [])
  const runners = useMemo(() => [runner(0.38), runner(-0.38)], [])
  const reins = useMemo(() => {
    const g = new BufferGeometry()
    const points: Vector3[] = []
    for (const r of TEAM) {
      points.push(new Vector3(0.2, 1.15, Math.sign(r.z) * 0.2), new Vector3(r.x + 0.42, 1.0, r.z))
    }
    g.setFromPoints(points)
    return g
  }, [])

  return (
    <group>
      <mesh geometry={body}>
        <meshStandardMaterial color="#b3121f" roughness={0.45} metalness={0.2} fog={false} />
      </mesh>
      {runners.map((g, i) => (
        <mesh key={i} geometry={g}>
          <meshStandardMaterial color="#e8c04a" metalness={0.85} roughness={0.25} fog={false} />
        </mesh>
      ))}
      {[-0.6, 0.5].flatMap((x) =>
        [0.38, -0.38].map((z) => (
          <mesh key={`${x}${z}`} position={[x, 0.18, z]}>
            <cylinderGeometry args={[0.025, 0.025, 0.26, 5]} />
            <meshStandardMaterial color="#e8c04a" metalness={0.85} roughness={0.25} fog={false} />
          </mesh>
        )),
      )}
      <Santa />
      {/* sacco pieno di regali */}
      <group position={[-0.62, 0.95, 0]}>
        <mesh scale={[1, 1.15, 1]}>
          <icosahedronGeometry args={[0.34, 1]} />
          <meshStandardMaterial color="#6b4a2a" roughness={1} flatShading fog={false} />
        </mesh>
        <mesh position={[0.05, 0.4, 0.05]} rotation={[0.3, 0.4, 0.2]}>
          <boxGeometry args={[0.2, 0.2, 0.2]} />
          <meshStandardMaterial color="#1e5b3a" roughness={0.6} fog={false} />
        </mesh>
        <mesh position={[-0.1, 0.38, -0.1]} rotation={[-0.2, 0.2, -0.3]}>
          <boxGeometry args={[0.17, 0.17, 0.17]} />
          <meshStandardMaterial color="#e8c04a" roughness={0.5} fog={false} />
        </mesh>
      </group>
      <lineSegments geometry={reins}>
        <lineBasicMaterial color="#e8c04a" fog={false} />
      </lineSegments>
      {TEAM.map((r, i) => (
        <group key={i} position={[r.x, 0.15, r.z]} scale={0.95}>
          <Reindeer pose="fly" animate={animate} rudolph={r.rudolph} phase={i * 0.7} fog={false} />
        </group>
      ))}
      {/* una luce calda che viaggia con la slitta, così si legge anche nel cielo scuro */}
      <pointLight position={[1.5, 2, 2]} intensity={6} distance={9} decay={1.5} color="#ffd9a8" />
    </group>
  )
}

/**
 * Babbo Natale attraversa il cielo a intervalli regolari, sempre davanti alla camera
 * (la segue come uno sfondo), lasciando una scia di polvere di stelle.
 */
export function SantaSleigh({ animate }: { animate: boolean }) {
  const camera = useThree((state) => state.camera) as PerspectiveCamera
  const size = useThree((state) => state.size)
  const anchor = useRef<Group>(null)
  const sleigh = useRef<Group>(null)
  const trail = useRef<(Sprite | null)[]>([])
  const clockRef = useRef(animate ? 1 : 6)

  const path = (u: number, dir: number, out: Vector3) => {
    const aspect = size.width / Math.max(size.height, 1)
    const halfH = Math.tan(MathUtils.degToRad(camera.fov / 2)) * DEPTH
    const halfW = halfH * aspect
    const reach = halfW + 7
    out.set(
      MathUtils.lerp(-reach, reach, u) * dir,
      halfH * 0.42 + Math.sin(u * Math.PI) * halfH * 0.12 + Math.sin(u * Math.PI * 5) * 0.35,
      -DEPTH,
    )
    return out
  }

  const here = useMemo(() => new Vector3(), [])
  const ahead = useMemo(() => new Vector3(), [])
  const past = useMemo(() => new Vector3(), [])

  useFrame((_, delta) => {
    const group = anchor.current
    const team = sleigh.current
    if (!group || !team) return
    group.position.copy(camera.position)
    group.quaternion.copy(camera.quaternion)
    if (animate) clockRef.current += Math.min(delta, 0.1)

    const t = clockRef.current
    const lap = Math.floor(t / PERIOD)
    const u = (t - lap * PERIOD) / CROSSING
    const dir = lap % 2 === 0 ? 1 : -1
    const visible = u >= 0 && u <= 1
    team.visible = visible
    trail.current.forEach((s) => s && (s.visible = visible))
    if (!visible) return

    path(u, dir, here)
    path(Math.min(u + 0.01, 1.01), dir, ahead)
    team.position.copy(here)
    // Guarda dove va, con un filo di beccheggio sulle onde del volo e un po' di tre quarti.
    team.rotation.set(0, dir > 0 ? -0.3 : Math.PI + 0.3, Math.atan2(ahead.y - here.y, Math.abs(ahead.x - here.x)))

    trail.current.forEach((sprite, k) => {
      if (!sprite) return
      path(u - (k + 1) * 0.008, dir, past)
      sprite.position.set(past.x, past.y + 0.25 + Math.sin(t * 9 + k) * 0.06, past.z)
      const fade = 1 - k / TRAIL
      sprite.scale.setScalar(0.9 * fade + 0.15)
      sprite.material.opacity = fade * (0.55 + 0.45 * Math.sin(t * 13 + k * 1.7))
    })
  })

  return (
    <group ref={anchor}>
      <group ref={sleigh} visible={false} scale={0.9}>
        <Team animate={animate} />
      </group>
      {Array.from({ length: TRAIL }, (_, k) => (
        <sprite
          key={k}
          ref={(s) => {
            trail.current[k] = s
          }}
          visible={false}
        >
          <spriteMaterial
            map={glowTexture()}
            color="#ffd27a"
            transparent
            depthWrite={false}
            blending={AdditiveBlending}
            fog={false}
            toneMapped={false}
          />
        </sprite>
      ))}
    </group>
  )
}
