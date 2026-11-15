import { useFrame, useThree } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import {
  AdditiveBlending,
  BackSide,
  BufferAttribute,
  BufferGeometry,
  Color,
  Group,
  Mesh,
  ShaderMaterial,
  Vector3,
} from 'three'
import { glowTexture } from './glow'
import { seeded } from './random'
import { SantaSleigh } from './SantaSleigh'

export const HORIZON = '#1c3554'
const ZENITH = '#03060f'
const SKY_RADIUS = 70

const skyVertex = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`
const skyFragment = /* glsl */ `
  uniform vec3 uHorizon;
  uniform vec3 uZenith;
  varying vec3 vDir;
  void main() {
    float h = clamp(vDir.y, 0.0, 1.0);
    vec3 color = mix(uHorizon, uZenith, pow(h, 0.55));
    // Un bagliore caldo appena sopra l'orizzonte, come le luci di un paese lontano.
    color += vec3(0.16, 0.08, 0.1) * exp(-h * 14.0) * 0.6;
    gl_FragColor = vec4(color, 1.0);
    #include <colorspace_fragment>
  }
`

/** Volta celeste: un gradiente dall'orizzonte blu notte allo zenit quasi nero. */
function Dome() {
  const uniforms = useMemo(
    () => ({ uHorizon: { value: new Color(HORIZON) }, uZenith: { value: new Color(ZENITH) } }),
    [],
  )
  return (
    <mesh renderOrder={-10}>
      <sphereGeometry args={[SKY_RADIUS, 32, 16]} />
      <shaderMaterial
        uniforms={uniforms}
        vertexShader={skyVertex}
        fragmentShader={skyFragment}
        side={BackSide}
        depthWrite={false}
        fog={false}
      />
    </mesh>
  )
}

const starVertex = /* glsl */ `
  uniform float uTime;
  uniform float uPixel;
  attribute float aSize;
  attribute float aPhase;
  varying float vAlpha;
  varying float vWarm;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    float twinkle = 0.55 + 0.45 * sin(uTime * (1.2 + fract(aPhase * 7.0) * 2.5) + aPhase);
    gl_PointSize = aSize * uPixel * (0.7 + 0.3 * twinkle);
    vAlpha = twinkle * smoothstep(0.02, 0.2, normalize(position).y);
    vWarm = fract(aPhase * 13.0);
  }
`
const starFragment = /* glsl */ `
  varying float vAlpha;
  varying float vWarm;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c);
    float core = smoothstep(0.5, 0.0, d);
    // Una crocetta sottile: le stelle più grandi brillano a quattro punte.
    float cross = max(smoothstep(0.06, 0.0, abs(c.x)), smoothstep(0.06, 0.0, abs(c.y))) * smoothstep(0.5, 0.1, d);
    float a = (pow(core, 3.0) + cross * 0.5) * vAlpha;
    vec3 tint = mix(vec3(0.8, 0.88, 1.0), vec3(1.0, 0.92, 0.78), step(0.75, vWarm));
    gl_FragColor = vec4(tint * 1.6, a);
  }
`

function Stars({ count, animate }: { count: number; animate: boolean }) {
  const material = useRef<ShaderMaterial>(null)
  const uniforms = useMemo(() => ({ uTime: { value: 0 }, uPixel: { value: 1 } }), [])
  const geometry = useMemo(() => {
    const rand = seeded(904)
    const positions = new Float32Array(count * 3)
    const sizes = new Float32Array(count)
    const phases = new Float32Array(count)
    const v = new Vector3()
    for (let i = 0; i < count; i++) {
      // Più fitte in alto: la parte bassa del cielo la copre la foschia.
      const y = 0.06 + Math.pow(rand(), 0.8) * 0.94
      const a = rand() * Math.PI * 2
      const r = Math.sqrt(1 - y * y)
      v.set(Math.cos(a) * r, y, Math.sin(a) * r).multiplyScalar(SKY_RADIUS - 4)
      positions.set([v.x, v.y, v.z], i * 3)
      const big = rand() > 0.93
      sizes[i] = big ? 7 + rand() * 5 : 2 + rand() * 3
      phases[i] = rand() * Math.PI * 2
    }
    const g = new BufferGeometry()
    g.setAttribute('position', new BufferAttribute(positions, 3))
    g.setAttribute('aSize', new BufferAttribute(sizes, 1))
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
    <points geometry={geometry} frustumCulled={false} renderOrder={-9}>
      <shaderMaterial
        ref={material}
        uniforms={uniforms}
        vertexShader={starVertex}
        fragmentShader={starFragment}
        transparent
        depthWrite={false}
        blending={AdditiveBlending}
        fog={false}
        toneMapped={false}
      />
    </points>
  )
}

const auroraVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`
const auroraFragment = /* glsl */ `
  uniform float uTime;
  varying vec2 vUv;

  float hash(float n) { return fract(sin(n) * 43758.5453); }
  float noise(float x) {
    float i = floor(x);
    float f = fract(x);
    return mix(hash(i), hash(i + 1.0), f * f * (3.0 - 2.0 * f));
  }
  float fbm(float x) {
    return noise(x) * 0.55 + noise(x * 2.3 + 7.1) * 0.3 + noise(x * 5.1 + 2.7) * 0.15;
  }

  void main() {
    float t = uTime * 0.05;
    float x = vUv.x * 34.0;
    // La tenda ondeggia: il bordo inferiore sale e scende piano lungo il cielo.
    float base = 0.18 + 0.22 * fbm(x * 0.35 + t * 3.0);
    float y = vUv.y - base;
    float body = smoothstep(0.0, 0.05, y) * exp(-max(y, 0.0) * 3.2);
    // Raggi verticali sottili che scorrono.
    float rays = 0.45 + 0.55 * fbm(x * 3.0 - t * 8.0);
    rays *= 0.6 + 0.4 * noise(x * 11.0 + t * 20.0);
    // Intensità a chiazze: alcune zone del cielo si accendono, altre si spengono.
    float patches = smoothstep(0.25, 0.75, fbm(x * 0.18 - t * 1.5 + 4.0));
    float a = body * rays * patches;
    vec3 green = vec3(0.15, 1.0, 0.55);
    vec3 teal = vec3(0.1, 0.65, 0.9);
    vec3 pink = vec3(0.85, 0.25, 0.7);
    vec3 color = mix(green, teal, smoothstep(0.0, 0.35, y));
    color = mix(color, pink, smoothstep(0.3, 0.8, y));
    float fade = smoothstep(0.0, 0.08, vUv.y) * smoothstep(1.0, 0.7, vUv.y);
    gl_FragColor = vec4(color * a * fade * 0.85, 1.0);
  }
`

/** Aurora boreale: un nastro di luce che corre lungo tutto il cielo, dietro le colline. */
function Aurora({ animate }: { animate: boolean }) {
  const material = useRef<ShaderMaterial>(null)
  const uniforms = useMemo(() => ({ uTime: { value: 37 } }), [])
  useFrame((_, delta) => {
    if (animate && material.current) material.current.uniforms.uTime.value += Math.min(delta, 0.1)
  })
  return (
    <mesh position={[0, 6, 0]} renderOrder={-8}>
      <cylinderGeometry args={[60, 52, 34, 96, 1, true]} />
      <shaderMaterial
        ref={material}
        uniforms={uniforms}
        vertexShader={auroraVertex}
        fragmentShader={auroraFragment}
        side={BackSide}
        transparent
        depthWrite={false}
        blending={AdditiveBlending}
        fog={false}
        toneMapped={false}
      />
    </mesh>
  )
}

/** Luna piena con un alone morbido. */
function Moon() {
  const position = useMemo(() => new Vector3(-0.55, 0.36, -0.75).normalize().multiplyScalar(58), [])
  const target = useMemo(() => new Vector3(0, 0, 0), [])
  const disc = useRef<Mesh>(null)
  useFrame(() => disc.current?.lookAt(target))
  return (
    <group position={position}>
      <mesh ref={disc} renderOrder={-7}>
        <circleGeometry args={[2.4, 40]} />
        <meshBasicMaterial color="#fff4dc" fog={false} toneMapped={false} />
      </mesh>
      <sprite scale={16} renderOrder={-7}>
        <spriteMaterial
          map={glowTexture()}
          color="#a9c4ff"
          transparent
          opacity={0.55}
          depthWrite={false}
          blending={AdditiveBlending}
          fog={false}
          toneMapped={false}
        />
      </sprite>
    </group>
  )
}

const streakVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`
const streakFragment = /* glsl */ `
  uniform float uOpacity;
  varying vec2 vUv;
  void main() {
    float head = pow(vUv.x, 3.0);
    float across = 1.0 - abs(vUv.y - 0.5) * 2.0;
    float a = head * pow(across, 2.0) * uOpacity;
    gl_FragColor = vec4(vec3(1.0, 0.95, 0.85) * 2.2, a);
  }
`

/** Ogni tanto una stella cadente attraversa il cielo, sempre nel campo visivo. */
function ShootingStar() {
  const camera = useThree((state) => state.camera)
  const anchor = useRef<Group>(null)
  const streak = useRef<Mesh>(null)
  const material = useRef<ShaderMaterial>(null)
  const uniforms = useMemo(() => ({ uOpacity: { value: 0 } }), [])
  const state = useRef({ next: 4, start: 0, from: new Vector3(), dir: new Vector3(), rand: seeded(77) })

  useFrame(({ clock }) => {
    const group = anchor.current
    const mesh = streak.current
    if (!group || !mesh) return
    group.position.copy(camera.position)
    group.quaternion.copy(camera.quaternion)
    const s = state.current
    const t = clock.elapsedTime
    if (t > s.next) {
      s.start = t
      s.next = t + 6 + s.rand() * 9
      const side = s.rand() > 0.5 ? 1 : -1
      s.from.set(-side * (6 + s.rand() * 10), 9 + s.rand() * 5, -40)
      s.dir.set(side * (0.8 + s.rand() * 0.3), -0.35 - s.rand() * 0.2, 0).normalize()
    }
    const life = (t - s.start) / 0.9
    if (life < 0 || life > 1 || s.start === 0) {
      mesh.visible = false
      return
    }
    mesh.visible = true
    mesh.position.copy(s.from).addScaledVector(s.dir, life * 22)
    mesh.rotation.z = Math.atan2(s.dir.y, s.dir.x)
    if (material.current) material.current.uniforms.uOpacity.value = Math.sin(life * Math.PI)
  })

  return (
    <group ref={anchor}>
      <mesh ref={streak} visible={false} renderOrder={-6}>
        <planeGeometry args={[7, 0.14]} />
        <shaderMaterial
          ref={material}
          uniforms={uniforms}
          vertexShader={streakVertex}
          fragmentShader={streakFragment}
          transparent
          depthWrite={false}
          blending={AdditiveBlending}
          fog={false}
          toneMapped={false}
        />
      </mesh>
    </group>
  )
}

export function Sky({ animate, rich }: { animate: boolean; rich: boolean }) {
  return (
    <group>
      <Dome />
      <Stars count={rich ? 900 : 500} animate={animate} />
      <Aurora animate={animate} />
      <Moon />
      {animate && <ShootingStar />}
      <SantaSleigh animate={animate} />
    </group>
  )
}
