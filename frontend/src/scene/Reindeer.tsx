import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import type { Group } from 'three'

const FUR = '#a8703f'
const LEG = '#6e4628'
const ANTLER = '#e2cfa4'

export type ReindeerPose = 'fly' | 'stand' | 'graze'

interface Props {
  pose: ReindeerPose
  animate: boolean
  /** Rudolph: naso rosso che si accende. */
  rudolph?: boolean
  /** Sfasa le zampe e la testa, così le renne non si muovono all'unisono. */
  phase?: number
  /** Le renne in cielo non devono sparire nella foschia. */
  fog?: boolean
}

function Antler({ side, fog }: { side: 1 | -1; fog: boolean }) {
  return (
    <group position={[-0.02, 0.1, side * 0.07]} rotation={[side * -0.35, 0, 0.35]}>
      <mesh position={[0, 0.17, 0]}>
        <cylinderGeometry args={[0.018, 0.026, 0.34, 5]} />
        <meshStandardMaterial color={ANTLER} roughness={0.8} flatShading fog={fog} />
      </mesh>
      {[0.1, 0.22].map((y, i) => (
        <mesh key={i} position={[0.05, y, 0]} rotation={[0, 0, -0.9]}>
          <cylinderGeometry args={[0.012, 0.018, 0.14, 4]} />
          <meshStandardMaterial color={ANTLER} roughness={0.8} flatShading fog={fog} />
        </mesh>
      ))}
    </group>
  )
}

/** Renna low-poly che guarda verso +x. In volo galoppa, a terra bruca o si guarda intorno. */
export function Reindeer({ pose, animate, rudolph = false, phase = 0, fog = true }: Props) {
  const legs = useRef<(Group | null)[]>([])
  const neck = useRef<Group>(null)
  const legSpots: [number, number][] = [
    [0.33, 0.13],
    [0.33, -0.13],
    [-0.33, 0.13],
    [-0.33, -0.13],
  ]
  const neckBase = pose === 'graze' ? -1.0 : 0.45

  useFrame(({ clock }) => {
    if (!animate) return
    const t = clock.elapsedTime + phase
    if (pose === 'fly') {
      legs.current.forEach((leg, i) => {
        if (!leg) return
        const front = i < 2
        leg.rotation.z = Math.sin(t * 7 + (front ? 0 : Math.PI) + (i % 2) * 0.4) * 0.55 + (front ? 0.5 : -0.5)
      })
      if (neck.current) neck.current.rotation.z = neckBase + Math.sin(t * 7) * 0.06
    } else if (neck.current) {
      // Ogni tanto alza la testa dal prato.
      const look = Math.max(0, Math.sin(t * 0.35)) ** 4
      neck.current.rotation.z = neckBase + (pose === 'graze' ? look * 1.3 : Math.sin(t * 0.5) * 0.08)
    }
  })

  return (
    <group>
      {/* corpo */}
      <mesh position={[0, 0.85, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <capsuleGeometry args={[0.2, 0.55, 3, 7]} />
        <meshStandardMaterial color={FUR} roughness={0.9} flatShading fog={fog} />
      </mesh>
      {/* pancia e coda chiare */}
      <mesh position={[0, 0.72, 0]} scale={[0.42, 0.1, 0.17]}>
        <sphereGeometry args={[1, 8, 6]} />
        <meshStandardMaterial color="#d8c0a0" roughness={0.9} flatShading fog={fog} />
      </mesh>
      <mesh position={[-0.5, 0.95, 0]}>
        <sphereGeometry args={[0.07, 6, 5]} />
        <meshStandardMaterial color="#f3ece2" roughness={0.9} flatShading fog={fog} />
      </mesh>

      {legSpots.map(([x, z], i) => (
        <group
          key={i}
          ref={(g) => {
            legs.current[i] = g
          }}
          position={[x, 0.78, z]}
          rotation={[0, 0, pose === 'fly' ? (i < 2 ? 0.5 : -0.5) : 0]}
        >
          <mesh position={[0, -0.36, 0]} castShadow>
            <cylinderGeometry args={[0.045, 0.035, 0.72, 5]} />
            <meshStandardMaterial color={LEG} roughness={0.9} flatShading fog={fog} />
          </mesh>
          <mesh position={[0, -0.72, 0]}>
            <boxGeometry args={[0.09, 0.05, 0.08]} />
            <meshStandardMaterial color="#2a1a10" roughness={0.9} fog={fog} />
          </mesh>
        </group>
      ))}

      {/* collo e testa ruotano insieme attorno alla spalla */}
      <group ref={neck} position={[0.38, 0.95, 0]} rotation={[0, 0, neckBase]}>
        <mesh position={[0.17, 0, 0]} rotation={[0, 0, -Math.PI / 2]} castShadow>
          <cylinderGeometry args={[0.08, 0.11, 0.38, 6]} />
          <meshStandardMaterial color={FUR} roughness={0.9} flatShading fog={fog} />
        </mesh>
        <group position={[0.38, 0, 0]} rotation={[0, 0, -neckBase - (pose === 'graze' ? 0.7 : 0.15)]}>
          <mesh position={[0.06, 0, 0]} scale={[0.17, 0.12, 0.11]}>
            <sphereGeometry args={[1, 8, 6]} />
            <meshStandardMaterial color={FUR} roughness={0.9} flatShading fog={fog} />
          </mesh>
          <mesh position={[0.2, -0.03, 0]} scale={[0.1, 0.075, 0.08]}>
            <sphereGeometry args={[1, 7, 5]} />
            <meshStandardMaterial color="#a8774e" roughness={0.9} flatShading fog={fog} />
          </mesh>
          <mesh position={[0.3, -0.02, 0]}>
            <sphereGeometry args={[rudolph ? 0.05 : 0.035, 8, 6]} />
            {rudolph ? (
              <meshStandardMaterial
                color="#ff2a2a"
                emissive="#ff1a1a"
                emissiveIntensity={4}
                toneMapped={false}
                fog={fog}
              />
            ) : (
              <meshStandardMaterial color="#1c120c" roughness={0.4} fog={fog} />
            )}
          </mesh>
          {[1, -1].map((side) => (
            <mesh key={side} position={[0.1, 0.04, side * 0.085]}>
              <sphereGeometry args={[0.018, 6, 5]} />
              <meshStandardMaterial color="#0d0806" roughness={0.3} fog={fog} />
            </mesh>
          ))}
          {[1, -1].map((side) => (
            <mesh key={side} position={[-0.04, 0.08, side * 0.11]} rotation={[side * 0.9, 0, 0]}>
              <coneGeometry args={[0.035, 0.12, 4]} />
              <meshStandardMaterial color={FUR} roughness={0.9} flatShading fog={fog} />
            </mesh>
          ))}
          <Antler side={1} fog={fog} />
          <Antler side={-1} fog={fog} />
        </group>
      </group>

      {/* collare con il campanello: solo per chi tira la slitta */}
      {pose === 'fly' && (
        <group position={[0.42, 0.98, 0]} rotation={[0, 0, -0.7]}>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.13, 0.03, 5, 12]} />
            <meshStandardMaterial color="#b3202a" roughness={0.5} fog={fog} />
          </mesh>
          <mesh position={[0, -0.14, 0]}>
            <sphereGeometry args={[0.04, 8, 6]} />
            <meshStandardMaterial color="#e8c04a" metalness={0.8} roughness={0.25} fog={fog} />
          </mesh>
        </group>
      )}
    </group>
  )
}
