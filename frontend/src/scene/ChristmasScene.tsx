import { Environment, Lightformer, PerformanceMonitor, Sparkles } from '@react-three/drei'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Bloom, EffectComposer, Noise, ToneMapping, Vignette, wrapEffect } from '@react-three/postprocessing'
import { BlendFunction, ToneMappingMode } from 'postprocessing'
import { useEffect, useRef, useState } from 'react'
import { CloseButton } from 'react-bootstrap'
import { MathUtils, type PerspectiveCamera, type Points, type ShaderMaterial } from 'three'
import type { UserPublic } from '../api/types'
import { Gingerbread } from '../components/Gingerbread'
import { GingerbreadRing } from './GingerbreadRing'
import { Landscape } from './Landscape'
import {
  CAMERA_HEIGHT,
  cameraDistance,
  cameraFov,
  INTRO_FOV,
  ringRadius,
  sceneryScale,
} from './layout'
import { Ground } from './Ground'
import { HORIZON, Sky } from './Sky'
import { Snow } from './Snow'
import { Tree, TREE_TOP } from './Tree'
import { prefersReducedMotion } from './webgl'
import { BarrelEffect, wideLensEvents } from './wideLens'

const Barrel = wrapEffect(BarrelEffect)

/**
 * Lo shader delle Sparkles di drei, negli angoli di ogni quadratino, dà un'alpha appena negativa.
 * Nel buffer half-float del post-processing non viene tagliata a zero e scurisce il fondo a
 * riquadri (con la camera vicina si vedono bene): la blocchiamo a zero.
 */
function clampSparkleAlpha(points: Points | null) {
  const material = points?.material as ShaderMaterial | undefined
  if (!material?.fragmentShader || material.userData.clamped) return
  material.fragmentShader = material.fragmentShader.replace(
    'strength * vOpacity',
    'max(strength, 0.0) * vOpacity',
  )
  material.userData.clamped = true
  material.needsUpdate = true
}

const INTRO_SECONDS = 3.6

// Densità del canvas: oltre 2 sul telefono non si vede differenza, si paga solo in GPU. Sotto 1,25
// la scena diventa sgranata, quindi in affanno si rinuncia prima a ombre e MSAA.
const MAX_DPR = Math.min(typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1, 2)
const MIN_DPR = Math.min(1.25, MAX_DPR)
// Il primo paio di secondi (shader da compilare, planata iniziale) non dice nulla sulle prestazioni.
const MONITOR_DELAY_MS = 2500

const easeOutCubic = (x: number) => 1 - Math.pow(1 - x, 3)

/**
 * Punto guardato dalla camera, sull'asse dell'albero: si guarda in su, omini in basso e stella in
 * alto. Col campo verticale più stretto (schermo orizzontale) si guarda un po' più su, così la
 * stella non finisce sotto il titolo.
 */
function lookHeight(fov: number): number {
  return 2.55 + MathUtils.clamp((100 - fov) / 28, 0, 1) * 0.55
}

interface Props {
  participants: UserPublic[]
  meId: string
  /** Falso nella pagina di accesso: gli omini fanno solo scena. */
  interactive?: boolean
  /** Pixel in basso coperti da altro (il pannello di accesso): l'inquadratura li evita. */
  bottomInset?: number
}

/**
 * Camera bassa e vicina, in grandangolo: gli omini in primo piano visti dal basso e l'albero che
 * svetta dietro. Gira piano attorno all'albero e gli omini le sfilano davanti. All'apertura arriva
 * dall'alto con una planata, e intanto l'obiettivo si apre; il puntatore la sposta appena.
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
  const size = useThree((state) => state.size)
  const angle = useRef(0)
  const elapsed = useRef(intro ? 0 : INTRO_SECONDS)
  const parallax = useRef({ x: 0, y: 0 })

  useFrame((state, rawDelta) => {
    const { pointer } = state
    const camera = state.camera as PerspectiveCamera
    const delta = Math.min(rawDelta, 0.1)
    elapsed.current += delta
    if (spinning) angle.current += delta * 0.07
    const p = easeOutCubic(Math.min(elapsed.current / INTRO_SECONDS, 1))

    parallax.current.x = MathUtils.damp(parallax.current.x, intro ? pointer.x : 0, 2.5, delta)
    parallax.current.y = MathUtils.damp(parallax.current.y, intro ? pointer.y : 0, 2.5, delta)

    const aspect = size.width / Math.max(size.height, 1)
    const fov = MathUtils.lerp(INTRO_FOV, cameraFov(aspect), p)
    if (Math.abs(camera.fov - fov) > 0.01) {
      camera.fov = fov
      camera.updateProjectionMatrix()
    }
    const distance = cameraDistance(radius) * (1 + (1 - p) * 2.2)
    const height = CAMERA_HEIGHT + (1 - p) * 9 + parallax.current.y * 0.12
    const theta = angle.current - (1 - p) * 1.1 + parallax.current.x * 0.1
    camera.position.set(Math.sin(theta) * distance, height, Math.cos(theta) * distance)
    // Se in basso c'è qualcosa sopra la scena (il pannello di accesso), l'inquadratura sale
    // di metà di quello spazio: albero e omini restano nella parte libera.
    const span = 2 * distance * Math.tan(MathUtils.degToRad(fov / 2))
    const inset = (bottomInset / Math.max(size.height, 1)) * 0.5 * span
    camera.lookAt(0, lookHeight(fov) - inset + (1 - p) * 1.5, 0)
  })
  return null
}

/**
 * Nebbia e paesaggio seguono la camera: con tanta gente il cerchio si allarga, la camera
 * si allontana, e bosco e foschia si allontanano con lei.
 */
function Scenery({ radius, rich, animate }: { radius: number; rich: boolean; animate: boolean }) {
  const distance = cameraDistance(radius)
  return (
    <>
      <fog attach="fog" args={[HORIZON, distance + 9, distance + 52]} />
      <Landscape rich={rich} animate={animate} scale={sceneryScale(radius)} />
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
  const [dpr, setDpr] = useState(MAX_DPR)
  // Su dispositivi in affanno si rinuncia a ombre, MSAA e a un po' di dettaglio, non alla magia.
  const [rich, setRich] = useState(true)
  const [monitoring, setMonitoring] = useState(false)
  useEffect(() => {
    const timer = setTimeout(() => setMonitoring(true), MONITOR_DELAY_MS)
    return () => clearTimeout(timer)
  }, [])
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
        camera={{ fov: INTRO_FOV, near: 0.05, far: 160, position: [0, 9, 16] }}
        events={wideLensEvents}
        gl={{ antialias: false, powerPreference: 'high-performance' }}
        onPointerMissed={() => setSelectedId(null)}
      >
        {/* La risoluzione segue gli fps a piccoli passi (e risale se c'è margine); ombre e MSAA si
            spengono solo se il telefono fatica anche alla risoluzione più bassa. */}
        {monitoring && (
          <PerformanceMonitor
            factor={1}
            step={0.2}
            flipflops={4}
            onChange={({ factor }) =>
              setDpr(Math.round((MIN_DPR + (MAX_DPR - MIN_DPR) * factor) * 4) / 4)
            }
            onDecline={({ factor }) => {
              if (factor < 0.05) setRich(false)
            }}
            onFallback={({ factor }) => {
              if (factor < 0.5) setRich(false)
            }}
          />
        )}
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
          ref={clampSparkleAlpha}
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
          {/* grana da pellicola, dopo il tone mapping: si vede nei mezzitoni, non sporca i neri */}
          <Noise blendFunction={BlendFunction.SOFT_LIGHT} opacity={0.4} />
          {/* obiettivo grandangolare: tutto il fotogramma si curva verso i bordi */}
          <Barrel />
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
