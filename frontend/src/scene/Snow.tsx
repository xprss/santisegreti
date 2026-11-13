import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import { AdditiveBlending, BufferAttribute, BufferGeometry, ShaderMaterial } from 'three'
import { seeded } from './random'

const HEIGHT = 12

const vertexShader = /* glsl */ `
  uniform float uTime;
  uniform float uSize;
  attribute float aSpeed;
  attribute float aPhase;
  varying float vFade;
  void main() {
    vec3 p = position;
    p.y = mod(p.y - uTime * aSpeed, ${HEIGHT.toFixed(1)}) - 0.5;
    p.x += sin(uTime * 0.6 + aPhase) * 0.3;
    p.z += cos(uTime * 0.45 + aPhase * 1.7) * 0.3;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = uSize * (0.55 + 0.45 * fract(aPhase)) / -mv.z;
    vFade = smoothstep(-0.5, 0.8, p.y);
  }
`

const fragmentShader = /* glsl */ `
  varying float vFade;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float alpha = smoothstep(0.5, 0.1, d) * 0.8 * vFade;
    gl_FragColor = vec4(1.0, 1.0, 1.0, alpha);
  }
`

/** Neve: un solo draw call, il movimento lo fa la GPU. */
export function Snow({ count, animate }: { count: number; animate: boolean }) {
  const material = useRef<ShaderMaterial>(null)
  const time = useRef(0)
  const uniforms = useMemo(() => ({ uTime: { value: 0 }, uSize: { value: 70 } }), [])

  const geometry = useMemo(() => {
    const rand = seeded(1712)
    const positions = new Float32Array(count * 3)
    const speeds = new Float32Array(count)
    const phases = new Float32Array(count)
    for (let i = 0; i < count; i++) {
      const r = Math.sqrt(rand()) * 15
      const a = rand() * Math.PI * 2
      positions.set([Math.cos(a) * r, rand() * HEIGHT, Math.sin(a) * r], i * 3)
      speeds[i] = 0.35 + rand() * 0.45
      phases[i] = rand() * Math.PI * 2
    }
    const g = new BufferGeometry()
    g.setAttribute('position', new BufferAttribute(positions, 3))
    g.setAttribute('aSpeed', new BufferAttribute(speeds, 1))
    g.setAttribute('aPhase', new BufferAttribute(phases, 1))
    return g
  }, [count])

  useFrame((state, delta) => {
    const mat = material.current
    if (!mat) return
    mat.uniforms.uSize.value = 70 * state.viewport.dpr
    if (!animate) return
    time.current += Math.min(delta, 0.1)
    mat.uniforms.uTime.value = time.current
  })

  return (
    <points geometry={geometry} frustumCulled={false}>
      <shaderMaterial
        ref={material}
        uniforms={uniforms}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        transparent
        depthWrite={false}
        blending={AdditiveBlending}
      />
    </points>
  )
}
