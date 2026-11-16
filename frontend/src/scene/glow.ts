import { CanvasTexture, SRGBColorSpace } from 'three'

let texture: CanvasTexture | null = null

/** Alone morbido condiviso da stella e lucine (un gradiente radiale disegnato una volta sola). */
export function glowTexture(): CanvasTexture {
  if (texture) return texture
  const size = 64
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const ctx = canvas.getContext('2d')!
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  gradient.addColorStop(0, 'rgba(255,255,255,1)')
  gradient.addColorStop(0.25, 'rgba(255,255,255,0.55)')
  gradient.addColorStop(0.6, 'rgba(255,255,255,0.12)')
  gradient.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, size, size)
  texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  return texture
}

function canvasTexture(width: number, height: number, draw: (ctx: CanvasRenderingContext2D) => void) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')!
  draw(ctx)
  const result = new CanvasTexture(canvas)
  result.colorSpace = SRGBColorSpace
  return result
}

/**
 * Una punta di luce che parte dal centro (c, c) e sfuma: un rombo lunghissimo e sottilissimo,
 * pieno al centro e trasparente in punta.
 */
function spike(ctx: CanvasRenderingContext2D, c: number, angle: number, length: number, width: number, rgb: string, alpha: number) {
  ctx.save()
  ctx.translate(c, c)
  ctx.rotate(angle)
  const gradient = ctx.createLinearGradient(0, 0, length, 0)
  gradient.addColorStop(0, `rgba(${rgb},${alpha})`)
  gradient.addColorStop(0.25, `rgba(${rgb},${alpha * 0.45})`)
  gradient.addColorStop(1, `rgba(${rgb},0)`)
  ctx.fillStyle = gradient
  ctx.beginPath()
  ctx.moveTo(0, -width)
  ctx.lineTo(length, 0)
  ctx.lineTo(0, width)
  ctx.closePath()
  ctx.fill()
  ctx.restore()
}

let glare: CanvasTexture | null = null

/**
 * Il glare della stella: quattro punte lunghe, quattro diagonali più corte e una raggiera di raggi
 * sottili. Ogni punta è disegnata tre volte (rosso, verde, blu) con lunghezze appena diverse:
 * in punta si apre un'iride, come la diffrazione di un obiettivo vero.
 */
export function glareTexture(): CanvasTexture {
  if (glare) return glare
  const size = 512
  const c = size / 2
  glare = canvasTexture(size, size, (ctx) => {
    ctx.globalCompositeOperation = 'lighter'
    const channels: [string, number][] = [
      ['255,110,80', 1],
      ['255,230,160', 0.93],
      ['120,170,255', 0.86],
    ]
    for (let i = 0; i < 8; i++) {
      const main = i % 2 === 0
      const angle = (i / 8) * Math.PI * 2
      for (const [rgb, stretch] of channels) {
        spike(ctx, c, angle, (main ? c : c * 0.55) * stretch, main ? 3.2 : 2.2, rgb, main ? 0.85 : 0.6)
      }
    }
    // Raggiera fine: tanti raggi deboli di lunghezza diversa (sempre gli stessi, seme fisso).
    let seed = 7
    const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646
    for (let i = 0; i < 48; i++) {
      spike(ctx, c, rand() * Math.PI * 2, c * (0.25 + rand() * 0.5), 1.1, '255,236,190', 0.22 + rand() * 0.2)
    }
    const core = ctx.createRadialGradient(c, c, 0, c, c, c * 0.22)
    core.addColorStop(0, 'rgba(255,255,255,1)')
    core.addColorStop(0.3, 'rgba(255,240,200,0.5)')
    core.addColorStop(1, 'rgba(255,220,150,0)')
    ctx.fillStyle = core
    ctx.fillRect(0, 0, size, size)
  })
  return glare
}

let streak: CanvasTexture | null = null

/** Striscia anamorfica: una lama di luce orizzontale, sottile al centro e lunghissima ai lati. */
export function streakTexture(): CanvasTexture {
  if (streak) return streak
  const width = 512
  const height = 32
  streak = canvasTexture(width, height, (ctx) => {
    const image = ctx.createImageData(width, height)
    for (let y = 0; y < height; y++) {
      const v = (y - height / 2 + 0.5) / (height / 2)
      const thin = Math.exp(-v * v * 18)
      for (let x = 0; x < width; x++) {
        const u = Math.abs((x - width / 2 + 0.5) / (width / 2))
        const along = Math.exp(-u * 3.2) * (1 - u) + Math.exp(-u * 40) * 0.6
        const a = Math.min(1, thin * along)
        const i = (y * width + x) * 4
        image.data[i] = image.data[i + 1] = image.data[i + 2] = 255
        image.data[i + 3] = Math.round(a * 255)
      }
    }
    ctx.putImageData(image, 0, 0)
  })
  return streak
}

let glint: CanvasTexture | null = null

/**
 * Le lucine come attraverso un filtro a stella: nucleo morbido e una croce di punte sottili,
 * più quattro diagonali appena accennate.
 */
export function glintTexture(): CanvasTexture {
  if (glint) return glint
  const size = 128
  const c = size / 2
  glint = canvasTexture(size, size, (ctx) => {
    ctx.globalCompositeOperation = 'lighter'
    for (let i = 0; i < 8; i++) {
      const main = i % 2 === 0
      spike(ctx, c, (i / 8) * Math.PI * 2, main ? c : c * 0.45, main ? 1.5 : 1, '255,255,255', main ? 0.9 : 0.45)
    }
    const core = ctx.createRadialGradient(c, c, 0, c, c, c * 0.42)
    core.addColorStop(0, 'rgba(255,255,255,1)')
    core.addColorStop(0.25, 'rgba(255,255,255,0.5)')
    core.addColorStop(0.6, 'rgba(255,255,255,0.1)')
    core.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = core
    ctx.fillRect(0, 0, size, size)
  })
  return glint
}
