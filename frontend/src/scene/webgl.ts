let supported: boolean | undefined

export function canUseWebGL(): boolean {
  if (supported !== undefined) return supported
  try {
    const canvas = document.createElement('canvas')
    supported = Boolean(canvas.getContext('webgl2') ?? canvas.getContext('webgl'))
  } catch {
    supported = false
  }
  return supported
}

export function prefersReducedMotion(): boolean {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
}
