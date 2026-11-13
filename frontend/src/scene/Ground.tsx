import { useMemo } from 'react'
import { seeded } from './random'

const GIFTS = [
  { angle: 0.35, distance: 2.05, size: [0.55, 0.42, 0.5], box: '#b3202a', ribbon: '#e8c04a' },
  { angle: 1.3, distance: 2.25, size: [0.42, 0.34, 0.42], box: '#f4efe6', ribbon: '#b3202a' },
  { angle: 2.6, distance: 2.1, size: [0.6, 0.36, 0.45], box: '#1e5b3a', ribbon: '#c9ced4' },
  { angle: 3.7, distance: 2.2, size: [0.4, 0.5, 0.4], box: '#d9a521', ribbon: '#b3202a' },
  { angle: 4.9, distance: 2.05, size: [0.5, 0.3, 0.5], box: '#8e1b22', ribbon: '#f4efe6' },
  { angle: 5.7, distance: 2.3, size: [0.36, 0.3, 0.36], box: '#c9ced4', ribbon: '#1e5b3a' },
] as const

/** Prato innevato, cumuli di neve attorno al tronco e pacchetti sotto l'albero. */
export function Ground() {
  const drifts = useMemo(() => {
    const rand = seeded(311)
    return Array.from({ length: 9 }, (_, i) => {
      const angle = (i / 9) * Math.PI * 2 + rand() * 0.4
      const distance = 0.6 + rand() * 1.2
      return {
        position: [Math.cos(angle) * distance, 0, Math.sin(angle) * distance] as const,
        scale: [0.5 + rand() * 0.5, 0.12 + rand() * 0.1, 0.5 + rand() * 0.5] as const,
        rotation: rand() * Math.PI,
      }
    })
  }, [])

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[40, 64]} />
        <meshStandardMaterial color="#dfe7ee" roughness={1} />
      </mesh>

      {drifts.map((drift, i) => (
        <mesh key={i} position={drift.position} scale={drift.scale} rotation={[0, drift.rotation, 0]}>
          <icosahedronGeometry args={[1, 1]} />
          <meshStandardMaterial color="#f1f5f8" roughness={1} flatShading />
        </mesh>
      ))}

      {GIFTS.map((gift, i) => {
        const [w, h, d] = gift.size
        return (
          <group
            key={i}
            position={[Math.cos(gift.angle) * gift.distance, h / 2, Math.sin(gift.angle) * gift.distance]}
            rotation={[0, gift.angle * 1.7, 0]}
          >
            <mesh>
              <boxGeometry args={[w, h, d]} />
              <meshStandardMaterial color={gift.box} roughness={0.6} />
            </mesh>
            <mesh>
              <boxGeometry args={[w * 1.02, h * 1.02, d * 0.18]} />
              <meshStandardMaterial color={gift.ribbon} roughness={0.35} metalness={0.3} />
            </mesh>
            <mesh>
              <boxGeometry args={[w * 0.18, h * 1.02, d * 1.02]} />
              <meshStandardMaterial color={gift.ribbon} roughness={0.35} metalness={0.3} />
            </mesh>
          </group>
        )
      })}
    </group>
  )
}
