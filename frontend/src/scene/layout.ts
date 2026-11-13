/** Raggio del cerchio di omini: largo abbastanza per l'albero, e con tanta gente le mani si sfiorano. */
export function ringRadius(count: number): number {
  return Math.max(3.5, (count * 1.02) / (Math.PI * 2))
}
