import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  ShaderMaterial,
} from 'three'
import { glowTexture } from './glow'
import { seeded } from './random'

const GIFTS = [
  { angle: 0.35, distance: 2.05, size: [0.55, 0.42, 0.5], box: '#b3202a', ribbon: '#e8c04a' },
  { angle: 1.3, distance: 2.25, size: [0.42, 0.34, 0.42], box: '#f4efe6', ribbon: '#b3202a' },
  { angle: 2.6, distance: 2.1, size: [0.6, 0.36, 0.45], box: '#1e5b3a', ribbon: '#e8c04a' },
  { angle: 3.7, distance: 2.2, size: [0.4, 0.5, 0.4], box: '#d9a521', ribbon: '#b3202a' },
  { angle: 4.9, distance: 2.05, size: [0.5, 0.3, 0.5], box: '#8e1b22', ribbon: '#f4efe6' },
  { angle: 5.7, distance: 2.3, size: [0.36, 0.3, 0.36], box: '#2a4f8a', ribbon: '#c9ced4' },
  { angle: 0.85, distance: 1.55, size: [0.34, 0.28, 0.34], box: '#6b2a7a', ribbon: '#e8c04a' },
  { angle: 3.1, distance: 1.6, size: [0.32, 0.26, 0.32], box: '#c81f2d', ribbon: '#f4efe6' },
  { angle: 5.2, distance: 1.6, size: [0.3, 0.34, 0.3], box: '#e8c04a', ribbon: '#1e5b3a' },
] as const

const glitterVertex = /* glsl */ `
  uniform float uTime;
  uniform float uPixel;
  attribute float aPhase;
  varying float vSpark;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    // Ogni cristallo brilla solo da certe angolazioni: girando la camera, la neve scintilla.
    vec3 view = normalize(cameraPosition - position);
    float s = sin(aPhase * 91.7 + dot(view, vec3(23.0, 41.0, 29.0)) + uTime * (0.4 + fract(aPhase) * 0.8));
    vSpark = pow(max(s, 0.0), 14.0);
    gl_PointSize = uPixel * (1.5 + vSpark * 5.0) * (14.0 / -mv.z);
  }
`
const glitterFragment = /* glsl */ `
  varying float vSpark;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c);
    float a = smoothstep(0.5, 0.0, d) * vSpark;
    gl_FragColor = vec4(vec3(1.0, 0.97, 0.9) * 2.0, a);
  }
`

function Glitter({ count, animate }: { count: number; animate: boolean }) {
  const material = useRef<ShaderMaterial>(null)
  const uniforms = useMemo(() => ({ uTime: { value: 0 }, uPixel: { value: 1 } }), [])
  const geometry = useMemo(() => {
    const rand = seeded(4401)
    const positions = new Float32Array(count * 3)
    const phases = new Float32Array(count)
    for (let i = 0; i < count; i++) {
      const r = 1.2 + Math.sqrt(rand()) * 17
      const a = rand() * Math.PI * 2
      positions.set([Math.cos(a) * r, 0.03, Math.sin(a) * r], i * 3)
      phases[i] = rand() * 10
    }
    const g = new BufferGeometry()
    g.setAttribute('position', new BufferAttribute(positions, 3))
    g.setAttribute('aPhase', new BufferAttribute(phases, 1))
    return g
  }, [count])

  useFrame((state) => {
    const mat = material.current
    if (!mat) return
    mat.uniforms.uPixel.value = state.viewport.dpr
    if (animate) mat.uniforms.uTime.value = state.clock.elapsedTime
  })

  return (
    <points geometry={geometry} frustumCulled={false}>
      <shaderMaterial
        ref={material}
        uniforms={uniforms}
        vertexShader={glitterVertex}
        fragmentShader={glitterFragment}
        transparent
        depthWrite={false}
        blending={AdditiveBlending}
        toneMapped={false}
      />
    </points>
  )
}

function Bow({ color, y }: { color: string; y: number }) {
  return (
    <group position={[0, y, 0]}>
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * 0.07, 0.05, 0]} rotation={[0, 0, side * 0.7]} scale={[1, 1, 0.55]}>
          <torusGeometry args={[0.07, 0.022, 6, 16]} />
          <meshStandardMaterial color={color} roughness={0.35} metalness={0.3} />
        </mesh>
      ))}
      <mesh position={[0, 0.02, 0]}>
        <sphereGeometry args={[0.035, 10, 8]} />
        <meshStandardMaterial color={color} roughness={0.35} metalness={0.3} />
      </mesh>
    </group>
  )
}

/** Prato innevato, cumuli di neve, pacchetti sotto l'albero e neve che scintilla. */
export function Ground({ radius, animate, rich }: { radius: number; animate: boolean; rich: boolean }) {
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

  // Cumuli più ampi sparsi nel prato, oltre il cerchio degli omini.
  const mounds = useMemo(() => {
    const rand = seeded(2718)
    return Array.from({ length: 16 }, () => {
      const angle = rand() * Math.PI * 2
      const distance = radius + 2 + rand() * 12
      return {
        position: [Math.cos(angle) * distance, -0.05, Math.sin(angle) * distance] as const,
        scale: [0.8 + rand() * 1.6, 0.18 + rand() * 0.25, 0.8 + rand() * 1.4] as const,
        rotation: rand() * Math.PI,
      }
    })
  }, [radius])


  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[60, 72]} />
        <meshStandardMaterial color="#d6e2ee" roughness={0.95} />
      </mesh>

      {/* la luce calda delle lucine che si posa sulla neve */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <planeGeometry args={[9, 9]} />
        <meshBasicMaterial
          map={glowTexture()}
          color="#ff9f45"
          transparent
          opacity={0.55}
          depthWrite={false}
          blending={AdditiveBlending}
        />
      </mesh>

      {drifts.map((drift, i) => (
        <mesh
          key={i}
          position={drift.position}
          scale={drift.scale}
          rotation={[0, drift.rotation, 0]}
          receiveShadow
        >
          <icosahedronGeometry args={[1, 1]} />
          <meshStandardMaterial color="#eef3f8" roughness={1} flatShading />
        </mesh>
      ))}

      {mounds.map((mound, i) => (
        <mesh
          key={i}
          position={mound.position}
          scale={mound.scale}
          rotation={[0, mound.rotation, 0]}
          receiveShadow
        >
          <icosahedronGeometry args={[1, 1]} />
          <meshStandardMaterial color="#e3ebf3" roughness={1} flatShading />
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
            <mesh castShadow receiveShadow>
              <boxGeometry args={[w, h, d]} />
              <meshStandardMaterial color={gift.box} roughness={0.55} />
            </mesh>
            <mesh>
              <boxGeometry args={[w * 1.02, h * 1.02, d * 0.18]} />
              <meshStandardMaterial color={gift.ribbon} roughness={0.3} metalness={0.45} />
            </mesh>
            <mesh>
              <boxGeometry args={[w * 0.18, h * 1.02, d * 1.02]} />
              <meshStandardMaterial color={gift.ribbon} roughness={0.3} metalness={0.45} />
            </mesh>
            <Bow color={gift.ribbon} y={h / 2} />
          </group>
        )
      })}

      <Glitter count={rich ? 700 : 400} animate={animate} />
    </group>
  )
}
