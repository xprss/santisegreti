import { MathUtils } from 'three'
import { TREE_TOP } from './Tree'

export const FOV = 38
/** Il bosco comincia qui (a scala 1): la camera deve restarne sempre fuori. */
export const FOREST_START = 20

/** Raggio del cerchio di omini: largo abbastanza per l'albero, e con tanta gente le mani si sfiorano. */
export function ringRadius(count: number): number {
  return Math.max(3.5, (count * 1.02) / (Math.PI * 2))
}

/** Distanza della camera dall'albero perché si vedano albero e omini, con margine per il titolo. */
export function cameraDistance(radius: number, aspect: number): number {
  const span = 2 * Math.tan(MathUtils.degToRad(FOV / 2))
  const needHeight = TREE_TOP + 3.6
  // In verticale (telefono a tutto schermo) gli omini ai lati possono sfiorare il bordo.
  const needWidth = 2 * (radius + 0.9) * (aspect < 0.75 ? 0.84 : 1)
  return Math.max(needHeight / span, needWidth / (span * aspect)) * 1.05
}

/**
 * Quanto alzare il punto guardato dalla camera. Se il riquadro è più alto del necessario
 * (telefono in verticale), l'albero scende verso il fondo e sopra resta più cielo, con aurora e luna.
 */
export function lookAtLift(radius: number, aspect: number): number {
  const span = 2 * Math.tan(MathUtils.degToRad(FOV / 2))
  const surplus = cameraDistance(radius, aspect) * span - (TREE_TOP + 3.6)
  return Math.max(0, surplus) * 0.3
}

/** Quanto allargare il paesaggio perché la camera, anche lontana, non finisca tra gli alberi. */
export function sceneryScale(radius: number, aspect: number): number {
  return Math.max(1, radius / ringRadius(0), (cameraDistance(radius, aspect) + 4) / FOREST_START)
}
