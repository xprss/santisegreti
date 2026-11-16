import { MathUtils } from 'three'

/** Il bosco comincia qui (a scala 1): la camera deve restarne sempre fuori. */
export const FOREST_START = 20

/** Campo visivo dell'arrivo, prima di aprirsi in grandangolo. */
export const INTRO_FOV = 42

/** Raggio del cerchio di omini: largo abbastanza per l'albero, e con tanta gente le mani si sfiorano. */
export function ringRadius(count: number): number {
  return Math.max(3.5, (count * 1.02) / (Math.PI * 2))
}

/**
 * Grandangolo spinto: circa 105° in orizzontale dove lo schermo lo permette. In verticale (telefono)
 * il campo orizzontale si stringe per forza, e quello verticale si ferma a 100° per non stirare
 * troppo cielo e neve.
 */
export function cameraFov(aspect: number): number {
  const horizontal = MathUtils.degToRad(105)
  const vertical = MathUtils.radToDeg(2 * Math.atan(Math.tan(horizontal / 2) / Math.max(aspect, 0.1)))
  return MathUtils.clamp(vertical, 72, 100)
}

/** Camera bassa, all'altezza della pancia degli omini: li guarda dal basso, con l'albero che svetta dietro. */
export const CAMERA_HEIGHT = 0.38

/** Distanza della camera dal centro: appena fuori dal cerchio, in primo piano sugli omini. */
export function cameraDistance(radius: number): number {
  return radius + 2.1
}

/** Quanto allargare il paesaggio perché la camera non finisca tra gli alberi del bosco. */
export function sceneryScale(radius: number): number {
  return Math.max(1, radius / ringRadius(0), (cameraDistance(radius) + 4) / FOREST_START)
}
