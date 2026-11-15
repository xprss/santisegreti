import { useFrame } from '@react-three/fiber'
import { useLayoutEffect, useMemo, useRef } from 'react'
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  CatmullRomCurve3,
  Color,
  ExtrudeGeometry,
  Float32BufferAttribute,
  InstancedMesh,
  Object3D,
  Points,
  Shape,
  Sprite,
  TubeGeometry,
  Vector3,
} from 'three'
import { glowTexture, raysTexture } from './glow'
import { seeded } from './random'

/** Palchi dell'abete, dal basso: base, raggio, altezza, numero di punte. */
const TIERS = [
  { y: 0.72, r: 2.3, h: 1.75, tips: 14 },
  { y: 1.55, r: 1.9, h: 1.6, tips: 13 },
  { y: 2.35, r: 1.5, h: 1.45, tips: 11 },
  { y: 3.1, r: 1.1, h: 1.3, tips: 9 },
  { y: 3.8, r: 0.68, h: 1.15, tips: 7 },
]
export const TREE_TOP = TIERS[TIERS.length - 1].y + TIERS[TIERS.length - 1].h

const GREENS = ['#174f2e', '#1d6238', '#247342', '#2d8a4e'].map((c) => new Color(c))
const UNDERSIDE = new Color('#0f3520')
const BAUBLE_COLORS = ['#c81f2d', '#d9a521', '#c9ced4', '#f4efe6', '#a3121f', '#e8c04a'].map(
  (c) => new Color(c),
)

interface TreeData {
  geometry: BufferGeometry
  baubles: { position: Vector3; color: Color; scale: number }[]
}

function buildTree(): TreeData {
  const rand = seeded(1225)
  const positions: number[] = []
  const colors: number[] = []
  const baubles: TreeData['baubles'] = []

  const ab = new Vector3()
  const ac = new Vector3()
  const normal = new Vector3()
  const centroid = new Vector3()

  const addTri = (a: Vector3, b: Vector3, c: Vector3, color: Color, outward: Vector3) => {
    ab.subVectors(b, a)
    ac.subVectors(c, a)
    normal.crossVectors(ab, ac)
    const [p, q] = normal.dot(outward) >= 0 ? [b, c] : [c, b]
    for (const v of [a, p, q]) {
      positions.push(v.x, v.y, v.z)
      colors.push(color.r, color.g, color.b)
    }
  }

  const faceColor = (lift: number) => {
    const base = GREENS[Math.min(GREENS.length - 1, Math.floor(rand() * 3 + lift))]
    return base.clone().offsetHSL((rand() - 0.5) * 0.02, 0, (rand() - 0.5) * 0.04)
  }

  let colorIndex = Math.floor(rand() * BAUBLE_COLORS.length)
  const nextBaubleColor = () => {
    colorIndex = (colorIndex + 1 + Math.floor(rand() * 2)) % BAUBLE_COLORS.length
    return BAUBLE_COLORS[colorIndex]
  }

  TIERS.forEach((tier, tierIndex) => {
    const { y, r, h, tips } = tier
    const spin = rand() * Math.PI * 2
    const apex = new Vector3((rand() - 0.5) * 0.04, y + h, (rand() - 0.5) * 0.04)

    const mid: Vector3[] = []
    for (let j = 0; j < tips; j++) {
      const angle = spin + (j / tips) * Math.PI * 2 + (rand() - 0.5) * 0.08
      const radius = r * (0.5 + rand() * 0.07)
      const height = y + h * (0.46 + rand() * 0.06)
      mid.push(new Vector3(Math.cos(angle) * radius, height, Math.sin(angle) * radius))
    }

    // Anello inferiore: punte dei rami (più larghe e cadenti) alternate a rientranze.
    const ring: Vector3[] = []
    for (let k = 0; k < tips * 2; k++) {
      const isTip = k % 2 === 0
      const angle = spin + (k / (tips * 2)) * Math.PI * 2 + (rand() - 0.5) * 0.06
      const radius = isTip ? r * (0.96 + rand() * 0.08) : r * (0.74 + rand() * 0.05)
      const drop = isTip ? -h * (0.1 + rand() * 0.06) : h * 0.05
      ring.push(new Vector3(Math.cos(angle) * radius, y + drop, Math.sin(angle) * radius))
    }

    const up = new Vector3()
    const outwardOf = (...vs: Vector3[]) => {
      centroid.set(0, 0, 0)
      vs.forEach((v) => centroid.add(v))
      centroid.divideScalar(vs.length)
      return up.set(centroid.x, Math.hypot(centroid.x, centroid.z) * 0.6, centroid.z)
    }

    for (let j = 0; j < tips; j++) {
      const m0 = mid[j]
      const m1 = mid[(j + 1) % tips]
      addTri(apex, m0, m1, faceColor(1.2), outwardOf(apex, m0, m1))

      // Il nodo intermedio sta sopra la punta: crinali che scendono verso i rami,
      // valli in corrispondenza delle rientranze.
      const t0 = ring[2 * j]
      const n0 = ring[2 * j + 1]
      const t1 = ring[(2 * j + 2) % (tips * 2)]
      addTri(m0, t0, n0, faceColor(0.4), outwardOf(m0, t0, n0))
      addTri(m0, n0, m1, faceColor(0.7), outwardOf(m0, n0, m1))
      addTri(m1, n0, t1, faceColor(0.4), outwardOf(m1, n0, t1))
    }

    const center = new Vector3(0, y + h * 0.18, 0)
    const down = new Vector3(0, -1, 0)
    for (let k = 0; k < tips * 2; k++) {
      addTri(center, ring[k], ring[(k + 1) % (tips * 2)], UNDERSIDE, down)
    }

    // Palline appese sotto le punte dei rami, una punta sì e una no (sfalsate tra i palchi).
    for (let k = tierIndex % 2; k < tips; k += 2) {
      const tip = ring[2 * k]
      baubles.push({
        position: new Vector3(tip.x * 0.93, tip.y - 0.13, tip.z * 0.93),
        color: nextBaubleColor(),
        scale: 0.105 + rand() * 0.035 - tierIndex * 0.008,
      })
    }
    // E qualcuna adagiata sui rami, all'altezza dell'anello intermedio.
    for (let j = (tierIndex + 1) % 3; j < tips; j += 3) {
      const m = mid[j]
      baubles.push({
        position: new Vector3(m.x * 1.1, m.y - 0.02, m.z * 1.1),
        color: nextBaubleColor(),
        scale: 0.09 + rand() * 0.02,
      })
    }
  })

  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geometry.setAttribute('color', new Float32BufferAttribute(colors, 3))
  geometry.computeVertexNormals()
  return { geometry, baubles }
}

/** Raggio approssimato della chioma a una certa altezza (per far correre le lucine). */
function canopyRadius(height: number): number {
  let radius = 0
  for (const { y, r, h } of TIERS) {
    if (height >= y - 0.05 && height <= y + h) {
      radius = Math.max(radius, r * 0.86 * (1 - (height - y) / h))
    }
  }
  return radius
}

const LIGHT_COUNT = 90
const LIGHT_WARM = [new Color('#ffcf7a'), new Color('#ffe2a8'), new Color('#ffb84a')]

function buildLights() {
  const rand = seeded(2412)
  const positions = new Float32Array(LIGHT_COUNT * 3)
  const base: Color[] = []
  const phases: number[] = []
  const turns = 5.5
  for (let i = 0; i < LIGHT_COUNT; i++) {
    const t = i / (LIGHT_COUNT - 1)
    const height = 0.75 + t * (TREE_TOP - 1.05)
    const angle = t * turns * Math.PI * 2
    const radius = canopyRadius(height) + 0.05
    positions.set([Math.cos(angle) * radius, height, Math.sin(angle) * radius], i * 3)
    base.push(LIGHT_WARM[Math.floor(rand() * LIGHT_WARM.length)])
    phases.push(rand() * Math.PI * 2)
  }
  return { positions, base, phases }
}

/** Festone dorato che gira attorno alla chioma e ricade un po' tra un ramo e l'altro. */
function buildGarland(): TubeGeometry {
  const points: Vector3[] = []
  const turns = 3.2
  const steps = 260
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    const height = 0.95 + t * (TREE_TOP - 1.7)
    const angle = Math.PI * 0.7 + t * turns * Math.PI * 2
    const sag = Math.pow(Math.abs(Math.sin(angle * 4.5)), 0.6) * 0.09
    const radius = canopyRadius(height) + 0.09
    points.push(new Vector3(Math.cos(angle) * radius, height - sag, Math.sin(angle) * radius))
  }
  return new TubeGeometry(new CatmullRomCurve3(points), 520, 0.028, 5)
}

function starShape(outer: number, inner: number): Shape {
  const shape = new Shape()
  for (let i = 0; i < 10; i++) {
    const radius = i % 2 === 0 ? outer : inner
    const angle = Math.PI / 2 + (i / 10) * Math.PI * 2
    const x = Math.cos(angle) * radius
    const y = Math.sin(angle) * radius
    if (i === 0) shape.moveTo(x, y)
    else shape.lineTo(x, y)
  }
  shape.closePath()
  return shape
}

const dummy = new Object3D()
const tmpColor = new Color()

export function Tree({ animate }: { animate: boolean }) {
  const { geometry, baubles } = useMemo(() => buildTree(), [])
  const lights = useMemo(() => buildLights(), [])
  const starGeometry = useMemo(() => {
    const g = new ExtrudeGeometry(starShape(0.4, 0.17), {
      depth: 0.08,
      bevelEnabled: true,
      bevelThickness: 0.04,
      bevelSize: 0.03,
      bevelSegments: 2,
    })
    g.center()
    return g
  }, [])

  const baubleMesh = useRef<InstancedMesh>(null)
  const lightMesh = useRef<InstancedMesh>(null)
  const glowPoints = useRef<Points>(null)
  const star = useRef<Object3D>(null)
  const halo = useRef<Sprite>(null)
  const rays = useRef<Sprite>(null)
  const garland = useMemo(() => buildGarland(), [])

  useLayoutEffect(() => {
    const mesh = baubleMesh.current
    if (!mesh) return
    baubles.forEach((bauble, i) => {
      dummy.position.copy(bauble.position)
      dummy.scale.setScalar(bauble.scale)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
      mesh.setColorAt(i, bauble.color)
    })
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  }, [baubles])

  useLayoutEffect(() => {
    const mesh = lightMesh.current
    if (!mesh) return
    for (let i = 0; i < LIGHT_COUNT; i++) {
      dummy.position.fromArray(lights.positions, i * 3)
      dummy.scale.setScalar(0.05)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
      mesh.setColorAt(i, lights.base[i])
    }
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  }, [lights])

  const glowGeometry = useMemo(() => {
    const g = new BufferGeometry()
    g.setAttribute('position', new BufferAttribute(lights.positions, 3))
    const colors = new Float32Array(LIGHT_COUNT * 3)
    lights.base.forEach((c, i) => colors.set([c.r, c.g, c.b], i * 3))
    g.setAttribute('color', new BufferAttribute(colors, 3))
    return g
  }, [lights])

  useFrame(({ clock }) => {
    if (!animate) return
    const t = clock.elapsedTime
    const mesh = lightMesh.current
    const colorAttr = glowGeometry.getAttribute('color') as BufferAttribute
    for (let i = 0; i < LIGHT_COUNT; i++) {
      // Scintillio di ogni lucina più un'onda di luce che sale a spirale lungo il filo.
      const twinkle = 0.55 + 0.45 * Math.sin(t * 1.6 + lights.phases[i])
      const wave = Math.pow(Math.max(0, Math.sin(t * 1.4 - i * 0.12)), 10)
      const pulse = twinkle + wave * 1.6
      tmpColor.copy(lights.base[i]).multiplyScalar(0.8 + pulse * 0.9)
      mesh?.setColorAt(i, tmpColor)
      tmpColor.copy(lights.base[i]).multiplyScalar(pulse * 0.6)
      colorAttr.setXYZ(i, tmpColor.r, tmpColor.g, tmpColor.b)
    }
    if (mesh?.instanceColor) mesh.instanceColor.needsUpdate = true
    colorAttr.needsUpdate = true

    if (star.current) star.current.rotation.y = t * 0.5
    if (halo.current) halo.current.scale.setScalar(1.9 + Math.sin(t * 1.3) * 0.15)
    if (rays.current) {
      rays.current.material.rotation = t * 0.12
      rays.current.scale.setScalar(3.4 + Math.sin(t * 0.9) * 0.35)
    }
  })

  return (
    <group>
      {/* tronco */}
      <mesh position={[0, 0.45, 0]} castShadow>
        <cylinderGeometry args={[0.24, 0.34, 0.9, 7]} />
        <meshStandardMaterial color="#5b3a22" roughness={0.95} flatShading />
      </mesh>

      {/* chioma */}
      <mesh geometry={geometry} castShadow receiveShadow>
        <meshStandardMaterial vertexColors flatShading roughness={0.82} />
      </mesh>

      {/* palline */}
      <instancedMesh ref={baubleMesh} args={[undefined, undefined, baubles.length]}>
        <icosahedronGeometry args={[1, 2]} />
        <meshStandardMaterial roughness={0.14} metalness={0.55} emissive="#2a1205" />
      </instancedMesh>

      {/* festone dorato */}
      <mesh geometry={garland}>
        <meshStandardMaterial
          color="#e8b64a"
          metalness={0.85}
          roughness={0.28}
          emissive="#5a3a08"
          emissiveIntensity={0.6}
          flatShading
        />
      </mesh>

      {/* lucine: nucleo luminoso + alone additivo */}
      <instancedMesh ref={lightMesh} args={[undefined, undefined, LIGHT_COUNT]}>
        <icosahedronGeometry args={[1, 1]} />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>
      <points ref={glowPoints} geometry={glowGeometry}>
        <pointsMaterial
          map={glowTexture()}
          size={0.8}
          sizeAttenuation
          vertexColors
          transparent
          depthWrite={false}
          blending={AdditiveBlending}
          toneMapped={false}
        />
      </points>

      {/* stella */}
      <group position={[0, TREE_TOP + 0.25, 0]}>
        <mesh ref={star} geometry={starGeometry}>
          <meshStandardMaterial
            color="#ffd04a"
            emissive="#ffae00"
            emissiveIntensity={2.2}
            metalness={0.5}
            roughness={0.3}
            toneMapped={false}
          />
        </mesh>
        <sprite ref={rays} scale={3.4}>
          <spriteMaterial
            map={raysTexture()}
            color="#ffd27a"
            transparent
            opacity={0.55}
            depthWrite={false}
            blending={AdditiveBlending}
            toneMapped={false}
          />
        </sprite>
        <sprite ref={halo} scale={1.9}>
          <spriteMaterial
            map={glowTexture()}
            color="#ffcf6b"
            transparent
            opacity={0.85}
            depthWrite={false}
            blending={AdditiveBlending}
            toneMapped={false}
          />
        </sprite>
      </group>
    </group>
  )
}
