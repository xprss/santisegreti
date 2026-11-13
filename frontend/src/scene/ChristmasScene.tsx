import { PerformanceMonitor } from '@react-three/drei'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useEffect, useRef, useState } from 'react'
import { CloseButton } from 'react-bootstrap'
import { MathUtils } from 'three'
import type { UserPublic } from '../api/types'
import { Gingerbread } from '../components/Gingerbread'
import { GingerbreadRing } from './GingerbreadRing'
import { ringRadius } from './layout'
import { Ground } from './Ground'
import { Snow } from './Snow'
import { Tree, TREE_TOP } from './Tree'
import { prefersReducedMotion } from './webgl'

const FOV = 38
const NIGHT = '#0d1b2a'

interface Props {
  participants: UserPublic[]
  meId: string
}

/** Camera che gira piano attorno all'albero e si allontana quanto basta per far stare tutti. */
function Rig({ radius, spinning }: { radius: number; spinning: boolean }) {
  const camera = useThree((state) => state.camera)
  const size = useThree((state) => state.size)
  const angle = useRef(0)

  useFrame((_, delta) => {
    if (spinning) angle.current += Math.min(delta, 0.1) * 0.07
    const aspect = size.width / Math.max(size.height, 1)
    const span = 2 * Math.tan(MathUtils.degToRad(FOV / 2))
    const needHeight = TREE_TOP + 1.6
    const needWidth = 2 * (radius + 0.9)
    const distance = Math.max(needHeight / span, needWidth / (span * aspect)) * 1.05
    const elevation = 0.3
    camera.position.set(
      Math.sin(angle.current) * distance * Math.cos(elevation),
      1.2 + distance * Math.sin(elevation),
      Math.cos(angle.current) * distance * Math.cos(elevation),
    )
    camera.lookAt(0, TREE_TOP * 0.42, 0)
  })
  return null
}

function useOnScreen<T extends Element>(ref: React.RefObject<T | null>) {
  const [visible, setVisible] = useState(true)
  useEffect(() => {
    const element = ref.current
    if (!element || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting))
    observer.observe(element)
    return () => observer.disconnect()
  }, [ref])
  return visible
}

export default function ChristmasScene({ participants, meId }: Props) {
  const container = useRef<HTMLDivElement>(null)
  const visible = useOnScreen(container)
  const [reduced] = useState(prefersReducedMotion)
  const [dpr, setDpr] = useState(1.5)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const radius = ringRadius(participants.length)
  const animate = !reduced
  const shownId = selectedId ?? hoveredId
  const shown = participants.find((p) => p.id === shownId) ?? null

  return (
    <div
      ref={container}
      className="position-absolute top-0 start-0 w-100 h-100"
      role="img"
      aria-label={`Un albero di Natale con ${participants.length} omini di pan di zenzero intorno`}
    >
      <Canvas
        dpr={[1, dpr]}
        frameloop={!visible ? 'never' : animate ? 'always' : 'demand'}
        camera={{ fov: FOV, near: 0.1, far: 80, position: [0, 5, 16] }}
        gl={{ antialias: true }}
        onPointerMissed={() => setSelectedId(null)}
      >
        <PerformanceMonitor onDecline={() => setDpr(1)} />
        <color attach="background" args={[NIGHT]} />
        <fog attach="fog" args={[NIGHT, 16, 38]} />

        <hemisphereLight args={['#bcd0ff', '#4a3524', 1.1]} />
        <directionalLight position={[6, 12, 8]} intensity={1.2} color="#dbe6ff" />
        <pointLight position={[0, 2.2, 3.2]} intensity={14} distance={12} decay={2} color="#ffb45c" />
        <pointLight position={[0, 2.2, -3.2]} intensity={14} distance={12} decay={2} color="#ffb45c" />
        <ambientLight intensity={0.25} color="#ffe2bd" />

        <Rig radius={radius} spinning={animate && selectedId === null} />
        <Ground />
        <Tree animate={animate} />
        <GingerbreadRing
          participants={participants}
          meId={meId}
          animate={animate}
          selectedId={selectedId}
          highlightedId={shownId}
          onSelect={setSelectedId}
          onHover={setHoveredId}
        />
        <Snow count={dpr > 1 ? 650 : 400} animate={animate} />
      </Canvas>

      {shown ? (
        <div className="ss-scene-card" aria-live="polite">
          <Gingerbread color={shown.color} size={40} className="flex-shrink-0" />
          <div className="flex-grow-1 min-w-0">
            <div className="fw-bold">{shown.id === meId ? `${shown.name} (tu)` : shown.name}</div>
            <div className="text-body-secondary">{shown.bio || 'Nessuna bio, per ora.'}</div>
          </div>
          {selectedId && (
            <CloseButton aria-label="Chiudi" onClick={() => setSelectedId(null)} />
          )}
        </div>
      ) : (
        <p className="ss-scene-hint">Un tocco su un omino e scopri chi è</p>
      )}
    </div>
  )
}
