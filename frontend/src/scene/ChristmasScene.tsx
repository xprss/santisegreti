import { Environment, Lightformer, PerformanceMonitor, Sparkles } from '@react-three/drei'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Bloom, EffectComposer, ToneMapping, Vignette } from '@react-three/postprocessing'
import { ToneMappingMode } from 'postprocessing'
import { useEffect, useRef, useState } from 'react'
import { CloseButton } from 'react-bootstrap'
import { MathUtils } from 'three'
import type { UserPublic } from '../api/types'
import { Gingerbread } from '../components/Gingerbread'
import { GingerbreadRing } from './GingerbreadRing'
import { Landscape } from './Landscape'
import { cameraDistance, FOV, lookAtLift, ringRadius, sceneryScale } from './layout'
import { Ground } from './Ground'
import { HORIZON, Sky } from './Sky'
import { Snow } from './Snow'
import { Tree, TREE_TOP } from './Tree'
import { prefersReducedMotion } from './webgl'

const INTRO_SECONDS = 3.6

const easeOutCubic = (x: number) => 1 - Math.pow(1 - x, 3)

interface Props {
  participants: UserPublic[]
  meId: string
  /** Falso nella pagina di accesso: gli omini fanno solo scena. */
  interactive?: boolean
  /** Pixel in basso coperti da altro (il pannello di accesso): l'inquadratura li evita. */
  bottomInset?: number
}

/**
 * Camera che gira piano attorno all'albero e si allontana quanto basta per far stare tutti.
 * All'apertura arriva dall'alto con una planata; il puntatore la sposta appena (parallasse).
 */
function Rig({
  radius,
  spinning,
  intro,
  bottomInset,
}: {
  radius: number
  spinning: boolean
  intro: boolean
  bottomInset: number
}) {
  const camera = useThree((state) => state.camera)
  const size = useThree((state) => state.size)
  const angle = useRef(0)
  const elapsed = useRef(intro ? 0 : INTRO_SECONDS)
  const parallax = useRef({ x: 0, y: 0 })

  useFrame(({ pointer }, rawDelta) => {
    const delta = Math.min(rawDelta, 0.1)
    elapsed.current += delta
    if (spinning) angle.current += delta * 0.07
    const p = easeOutCubic(Math.min(elapsed.current / INTRO_SECONDS, 1))

    parallax.current.x = MathUtils.damp(parallax.current.x, intro ? pointer.x : 0, 2.5, delta)
    parallax.current.y = MathUtils.damp(parallax.current.y, intro ? pointer.y : 0, 2.5, delta)

    const aspect = size.width / Math.max(size.height, 1)
    const fit = cameraDistance(radius, aspect)
    const distance = fit * (1 + (1 - p) * 0.6)
    const elevation = 0.17 + (1 - p) * 0.6 + parallax.current.y * 0.04
    const theta = angle.current - (1 - p) * 1.1 + parallax.current.x * 0.12
    camera.position.set(
      Math.sin(theta) * distance * Math.cos(elevation),
      1.1 + distance * Math.sin(elevation),
      Math.cos(theta) * distance * Math.cos(elevation),
    )
    // Se in basso c'è qualcosa sopra la scena (il pannello di accesso), l'inquadratura sale
    // di metà di quello spazio: albero e omini restano nella parte libera.
    const inset = (bottomInset / Math.max(size.height, 1)) * 0.5 * distance * 2 * Math.tan(MathUtils.degToRad(FOV / 2))
    camera.lookAt(0, TREE_TOP * 0.45 + lookAtLift(radius, aspect) - inset + (1 - p) * 1.2, 0)
  })
  return null
}

/**
 * Nebbia e paesaggio seguono la camera: con un formato alto (telefono) o tanta gente
 * la camera si allontana, e bosco e foschia si allontanano con lei.
 */
function Scenery({ radius, rich, animate }: { radius: number; rich: boolean; animate: boolean }) {
  const size = useThree((state) => state.size)
  const aspect = size.width / Math.max(size.height, 1)
  const distance = cameraDistance(radius, aspect)
  return (
    <>
      <fog attach="fog" args={[HORIZON, distance + 4, distance + 46]} />
      <Landscape rich={rich} animate={animate} scale={sceneryScale(radius, aspect)} />
    </>
  )
}

/** Riflessi per palline e festone: qualche pannello di luce calda e fredda, niente file da scaricare. */
function Reflections() {
  return (
    <Environment frames={1} resolution={128} environmentIntensity={0.45}>
      <Lightformer form="ring" intensity={3} color="#ffbf6b" position={[0, 2, 6]} scale={4} />
      <Lightformer form="rect" intensity={2} color="#9fbfff" position={[-6, 6, -4]} scale={[6, 3, 1]} />
      <Lightformer form="rect" intensity={1.5} color="#ff8fa3" position={[6, 1, -3]} scale={[3, 5, 1]} />
      <Lightformer form="circle" intensity={4} color="#fff2d6" position={[0, 9, 0]} scale={3} />
    </Environment>
  )
}

function useOnScreen<T extends Element>(ref: React.RefObject<T | null>) {
  const [visible, setVisible] = useState(true)
  useEffect(() => {
    const element = ref.current
    if (!element || typeof IntersectionObserver === 'undefined') return
    // La parte coperta dall'header sticky non conta: sul telefono lo snap lascia lì sotto il fondo
    // della scena, e senza questo margine il WebGL continuerebbe a disegnare mentre leggi la pagina.
    const header = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--ss-header-h')) || 0
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), {
      rootMargin: `${-Math.ceil(header + 1)}px 0px 0px 0px`,
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [ref])
  return visible
}

export default function ChristmasScene({
  participants,
  meId,
  interactive = true,
  bottomInset = 0,
}: Props) {
  const container = useRef<HTMLDivElement>(null)
  const visible = useOnScreen(container)
  const [reduced] = useState(prefersReducedMotion)
  const [dpr, setDpr] = useState(1.5)
  // Su dispositivi in affanno si rinuncia a ombre, MSAA e a un po' di dettaglio, non alla magia.
  const [rich, setRich] = useState(true)
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
        shadows={rich}
        frameloop={!visible ? 'never' : animate ? 'always' : 'demand'}
        camera={{ fov: FOV, near: 0.1, far: 160, position: [0, 5, 16] }}
        gl={{ antialias: false, powerPreference: 'high-performance' }}
        onPointerMissed={() => setSelectedId(null)}
      >
        <PerformanceMonitor
          onDecline={() => {
            setDpr(1)
            setRich(false)
          }}
        />
        <color attach="background" args={[HORIZON]} />

        <hemisphereLight args={['#9db8ff', '#3a2a24', 0.75]} />
        {/* la luna: luce fredda e radente, ombre lunghe sulla neve */}
        <directionalLight
          position={[-10, 13, -14]}
          intensity={1.5}
          color="#c4d6ff"
          castShadow={rich}
          shadow-mapSize={[1024, 1024]}
          shadow-camera-left={-10}
          shadow-camera-right={10}
          shadow-camera-top={10}
          shadow-camera-bottom={-10}
          shadow-camera-near={1}
          shadow-camera-far={45}
          shadow-bias={-0.0005}
          shadow-normalBias={0.03}
        />
        <directionalLight position={[6, 8, 10]} intensity={0.45} color="#dbe6ff" />
        <pointLight position={[0, 2.2, 3.2]} intensity={16} distance={12} decay={2} color="#ffb45c" />
        <pointLight position={[0, 2.2, -3.2]} intensity={16} distance={12} decay={2} color="#ffb45c" />
        <pointLight position={[0, TREE_TOP + 0.3, 0]} intensity={6} distance={9} decay={2} color="#ffd27a" />
        <ambientLight intensity={0.18} color="#ffe2bd" />
        <Reflections />

        <Rig
          radius={radius}
          spinning={animate && selectedId === null}
          intro={animate}
          bottomInset={bottomInset}
        />
        <Sky animate={animate} rich={rich} />
        <Scenery radius={radius} rich={rich} animate={animate} />
        <Ground radius={radius} animate={animate} rich={rich} />
        <Tree animate={animate} />
        <Sparkles
          count={rich ? 70 : 40}
          scale={[5.5, TREE_TOP + 1, 5.5]}
          position={[0, (TREE_TOP + 1) / 2, 0]}
          size={3.2}
          speed={animate ? 0.35 : 0}
          noise={0.6}
          color="#ffd98a"
          opacity={0.9}
        />
        <GingerbreadRing
          participants={participants}
          meId={meId}
          animate={animate}
          selectedId={selectedId}
          highlightedId={shownId}
          onSelect={setSelectedId}
          onHover={setHoveredId}
          interactive={interactive}
        />
        <Snow count={rich ? 900 : 500} animate={animate} />

        <EffectComposer multisampling={rich ? 4 : 0}>
          <Bloom mipmapBlur luminanceThreshold={0.95} luminanceSmoothing={0.2} intensity={1.15} radius={0.75} />
          <Vignette offset={0.28} darkness={0.55} />
          <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
        </EffectComposer>
      </Canvas>

      {shown ? (
        <div className="ss-scene-card" aria-live="polite">
          <Gingerbread
            color={shown.color}
            accessory={shown.accessory}
            size={40}
            className="flex-shrink-0"
          />
          <div className="flex-grow-1 min-w-0">
            <div className="fw-bold">{shown.id === meId ? `${shown.name} (tu)` : shown.name}</div>
            <div className="text-body-secondary">{shown.bio || 'Nessuna bio, per ora.'}</div>
          </div>
          {selectedId && (
            <CloseButton aria-label="Chiudi" onClick={() => setSelectedId(null)} />
          )}
        </div>
      ) : null}
    </div>
  )
}
