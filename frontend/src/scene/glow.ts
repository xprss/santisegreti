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

let rays: CanvasTexture | null = null

/** Raggi sottili attorno alla stella: spicchi di luce che sfumano verso l'esterno. */
export function raysTexture(): CanvasTexture {
  if (rays) return rays
  const size = 256
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const ctx = canvas.getContext('2d')!
  const c = size / 2
  const gradient = ctx.createRadialGradient(c, c, 0, c, c, c)
  gradient.addColorStop(0, 'rgba(255,255,255,0.9)')
  gradient.addColorStop(0.35, 'rgba(255,255,255,0.25)')
  gradient.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = gradient
  const count = 16
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2
    const width = i % 2 === 0 ? 0.07 : 0.035
    const length = i % 2 === 0 ? c : c * 0.62
    ctx.beginPath()
    ctx.moveTo(c, c)
    ctx.lineTo(c + Math.cos(angle - width) * length, c + Math.sin(angle - width) * length)
    ctx.lineTo(c + Math.cos(angle + width) * length, c + Math.sin(angle + width) * length)
    ctx.closePath()
    ctx.fill()
  }
  rays = new CanvasTexture(canvas)
  rays.colorSpace = SRGBColorSpace
  return rays
}
