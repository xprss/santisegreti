/**
 * Accessori per l'omino di pan di zenzero.
 *
 * Ogni accessorio è fatto di parti disegnate nello stesso sistema di coordinate della sagoma
 * dell'omino (0–100 × 0–120, y verso il basso; testa centrata in 50,25 con raggio 19).
 * La stessa descrizione serve sia per l'SVG sia per la scena 3D, dove le parti piene diventano
 * sagome estruse (come decorazioni di zucchero) e i tratti diventano tubicini.
 *
 * Gli id devono restare allineati con `Accessory` nel backend (app/models/accessories.py).
 */

export type AccessoryId =
  | 'santa_hat'
  | 'elf_hat'
  | 'reindeer_antlers'
  | 'baseball_cap'
  | 'witch_hat'
  | 'top_hat'
  | 'crown'
  | 'halo'
  | 'headphones'
  | 'clown_wig'
  | 'punk_mohawk'
  | 'mustache'
  | 'glasses'
  | 'sunglasses'
  | 'ski_goggles'
  | 'tie'
  | 'bow_tie'
  | 'scarf'
  | 'crossbody_bag'
  | 'school_backpack'

/**
 * - `front`: appoggiata sul davanti del biscotto (occhiali, cravatta…)
 * - `wrap`: avvolge il biscotto da davanti a dietro (cappelli, parrucche…)
 * - `back`: dietro il biscotto; nell'SVG si disegna prima della sagoma (zaino)
 */
export type PartLayer = 'front' | 'wrap' | 'back'

export interface AccessoryPart {
  kind: 'fill' | 'stroke'
  d: string
  color: string
  layer: PartLayer
  /** Spessore dell'estrusione 3D, nelle unità della sagoma. */
  depth?: number
  /** Larghezza del tratto (solo `stroke`). */
  width?: number
  metal?: boolean
  glow?: boolean
  opacity?: number
}

export interface Accessory {
  id: AccessoryId
  label: string
  group: AccessoryGroupId
  parts: AccessoryPart[]
}

export type AccessoryGroupId = 'head' | 'hair' | 'eyes' | 'neck' | 'carry'

export const ACCESSORY_GROUPS: { id: AccessoryGroupId; label: string }[] = [
  { id: 'head', label: 'In testa' },
  { id: 'hair', label: 'Capelli e baffi' },
  { id: 'eyes', label: 'Occhiali' },
  { id: 'neck', label: 'Al collo' },
  { id: 'carry', label: 'In spalla' },
]

const circle = (cx: number, cy: number, r: number) =>
  `M${cx - r} ${cy} A${r} ${r} 0 1 0 ${cx + r} ${cy} A${r} ${r} 0 1 0 ${cx - r} ${cy} Z`

const ellipse = (cx: number, cy: number, rx: number, ry: number) =>
  `M${cx - rx} ${cy} A${rx} ${ry} 0 1 0 ${cx + rx} ${cy} A${rx} ${ry} 0 1 0 ${cx - rx} ${cy} Z`

const roundedRect = (x: number, y: number, w: number, h: number, r: number) =>
  `M${x + r} ${y} H${x + w - r} A${r} ${r} 0 0 1 ${x + w} ${y + r} V${y + h - r} ` +
  `A${r} ${r} 0 0 1 ${x + w - r} ${y + h} H${x + r} A${r} ${r} 0 0 1 ${x} ${y + h - r} ` +
  `V${y + r} A${r} ${r} 0 0 1 ${x + r} ${y} Z`

const fill = (
  d: string,
  color: string,
  layer: PartLayer,
  depth: number,
  extra: Partial<AccessoryPart> = {},
): AccessoryPart => ({ kind: 'fill', d, color, layer, depth, ...extra })

const stroke = (
  d: string,
  color: string,
  layer: PartLayer,
  width: number,
  extra: Partial<AccessoryPart> = {},
): AccessoryPart => ({ kind: 'stroke', d, color, layer, width, ...extra })

const WHITE = '#FBF8F3'
const GOLD = '#E0B53A'
const BLACK = '#1E1B1A'

export const ACCESSORIES: Accessory[] = [
  {
    id: 'santa_hat',
    label: 'Cappello di Babbo Natale',
    group: 'head',
    parts: [
      fill(
        'M32 9 C33 -6 44 -16 58 -16 C68 -16 75 -10 77 -2 L70 0 C67 -6 63 -8 58 -7 C64 -2 67 3 68 9 Z',
        '#C8232C',
        'wrap',
        26,
      ),
      fill(roundedRect(29, 5, 42, 8, 4), WHITE, 'wrap', 30),
      fill(circle(75, -3, 5.5), WHITE, 'wrap', 14),
    ],
  },
  {
    id: 'elf_hat',
    label: 'Cappello da elfo',
    group: 'head',
    parts: [
      fill('M33 9 C36 -4 30 -14 22 -22 C40 -18 58 -8 67 9 Z', '#1E8449', 'wrap', 26),
      fill(
        'M31 5 H69 L69 12 L64.25 15 L59.5 12 L54.75 15 L50 12 L45.25 15 L40.5 12 L35.75 15 L31 12 Z',
        '#C0392B',
        'wrap',
        30,
      ),
      fill(circle(22, -22, 3.6), GOLD, 'wrap', 10, { metal: true }),
    ],
  },
  {
    id: 'reindeer_antlers',
    label: 'Corna da renna',
    group: 'head',
    parts: [
      stroke('M31 17 C31 -2 69 -2 69 17', '#6D4C41', 'wrap', 3),
      stroke(
        'M38 5 L33 -6 L26 -16 M33 -6 L24 -7 M29.5 -11 L33 -18 ' +
          'M62 5 L67 -6 L74 -16 M67 -6 L76 -7 M70.5 -11 L67 -18',
        '#A1785C',
        'wrap',
        3.6,
      ),
    ],
  },
  {
    id: 'baseball_cap',
    label: 'Cappellino da baseball',
    group: 'head',
    parts: [
      fill('M31 16 C31 3 39 -1 50 -1 C61 -1 69 3 69 16 Z', '#24427A', 'wrap', 28),
      fill(ellipse(50, 16, 22, 3.2), '#18305C', 'front', 14),
      fill(circle(50, -1, 2), '#24427A', 'wrap', 10),
      fill(circle(50, 8, 3.2), WHITE, 'front', 1),
    ],
  },
  {
    id: 'witch_hat',
    label: 'Cappello da strega',
    group: 'head',
    parts: [
      fill('M36 8 L47 -20 C48 -23 53 -25 57 -22 L52 -19 L64 8 Z', '#2B2140', 'wrap', 24),
      fill('M38.5 2 L61.5 2 L63.3 6.5 L36.7 6.5 Z', '#E67E22', 'wrap', 26),
      fill('M47 2.5 H53 V6 H47 Z', GOLD, 'front', 2, { metal: true }),
      fill(ellipse(50, 9, 27, 4.5), '#2B2140', 'wrap', 34),
    ],
  },
  {
    id: 'top_hat',
    label: 'Cilindro',
    group: 'head',
    parts: [
      fill('M37 6 L38 -18 H62 L63 6 Z', BLACK, 'wrap', 26),
      fill('M37.3 0 H62.7 L62.9 5 H37.1 Z', '#B3202A', 'wrap', 27),
      fill(roundedRect(30, 6, 40, 5, 2.5), BLACK, 'wrap', 32),
    ],
  },
  {
    id: 'crown',
    label: 'Corona',
    group: 'head',
    parts: [
      fill('M33 11 L32 -3 L40.5 4 L50 -8 L59.5 4 L68 -3 L67 11 Z', GOLD, 'wrap', 24, {
        metal: true,
      }),
      fill(circle(32, -3, 1.8), GOLD, 'wrap', 6, { metal: true }),
      fill(circle(50, -8, 1.8), GOLD, 'wrap', 6, { metal: true }),
      fill(circle(68, -3, 1.8), GOLD, 'wrap', 6, { metal: true }),
      fill(circle(50, 5.5, 2.2), '#C0392B', 'front', 2),
      fill(circle(41, 7, 1.6), '#2E86C1', 'front', 2),
      fill(circle(59, 7, 1.6), '#1E8449', 'front', 2),
    ],
  },
  {
    id: 'halo',
    label: 'Aureola',
    group: 'head',
    parts: [stroke(ellipse(50, -6, 14, 3.8), '#F6CD4C', 'wrap', 3, { glow: true })],
  },
  {
    id: 'headphones',
    label: 'Cuffie',
    group: 'head',
    parts: [
      stroke('M28 20 C28 -4 72 -4 72 20', '#2C2C2C', 'wrap', 4),
      fill(roundedRect(25, 15, 9, 16, 3), '#2C2C2C', 'wrap', 30),
      fill(roundedRect(66, 15, 9, 16, 3), '#2C2C2C', 'wrap', 30),
      fill(circle(29.5, 23, 2), '#E74C3C', 'front', 1),
      fill(circle(70.5, 23, 2), '#E74C3C', 'front', 1),
    ],
  },
  {
    id: 'clown_wig',
    label: 'Parrucca da clown',
    group: 'hair',
    parts: [
      fill(circle(30, 12, 7), '#E74C3C', 'wrap', 26),
      fill(circle(25, 21, 7), '#F1C40F', 'wrap', 26),
      fill(circle(28, 30, 6), '#2ECC71', 'wrap', 26),
      fill(circle(70, 12, 7), '#3498DB', 'wrap', 26),
      fill(circle(75, 21, 7), '#9B59B6', 'wrap', 26),
      fill(circle(72, 30, 6), '#E67E22', 'wrap', 26),
      fill(circle(40, 5, 6), '#F1C40F', 'wrap', 26),
      fill(circle(50, 2.5, 6), '#E74C3C', 'wrap', 26),
      fill(circle(60, 5, 6), '#2ECC71', 'wrap', 26),
    ],
  },
  {
    id: 'punk_mohawk',
    label: 'Cresta punk',
    group: 'hair',
    parts: [
      fill(
        'M44 10 L41 -4 L46 0 L45 -14 L50 -3 L52 -18 L54 -2 L58 -10 L57 2 L61 -2 L56 10 Z',
        '#E91E63',
        'wrap',
        26,
      ),
    ],
  },
  {
    id: 'mustache',
    label: 'Baffi',
    group: 'hair',
    parts: [
      fill(
        'M50 28.5 C47 25.5 41 25 37.5 28.5 C36.5 29.5 37 31 38.5 30.5 C41.5 29.5 45 31.5 48 31 ' +
          'C49.2 30.8 50 30 50 29.5 C50 30 50.8 30.8 52 31 C55 31.5 58.5 29.5 61.5 30.5 ' +
          'C63 31 63.5 29.5 62.5 28.5 C59 25 53 25.5 50 28.5 Z',
        '#3B2A20',
        'front',
        3,
      ),
    ],
  },
  {
    id: 'glasses',
    label: 'Occhiali da vista',
    group: 'eyes',
    parts: [
      fill(circle(43, 22, 5.5), '#DDEBF7', 'front', 0.6, { opacity: 0.35 }),
      fill(circle(57, 22, 5.5), '#DDEBF7', 'front', 0.6, { opacity: 0.35 }),
      stroke(
        `${circle(43, 22, 5.5)} ${circle(57, 22, 5.5)} M48.5 21 Q50 19.5 51.5 21 ` +
          'M37.5 21 L31.5 19.5 M62.5 21 L68.5 19.5',
        '#3B2A20',
        'front',
        1.8,
      ),
    ],
  },
  {
    id: 'sunglasses',
    label: 'Occhiali da sole',
    group: 'eyes',
    parts: [
      stroke('M31.5 20 L37 20 M48 20.5 Q50 19 52 20.5 M63 20 L68.5 20', BLACK, 'front', 1.8),
      fill('M37 18 H48 V22.5 C48 26 46 27 43 27 H41.5 C38.5 27 37 25.5 37 22.5 Z', BLACK, 'front', 2),
      fill('M52 18 H63 V22.5 C63 25.5 61.5 27 58.5 27 H57 C54 27 52 26 52 22.5 Z', BLACK, 'front', 2),
      fill('M39 19.5 L42.5 19.5 L39.5 23.5 Z', '#FFFFFF', 'front', 2.3, { opacity: 0.6 }),
      fill('M54 19.5 L57.5 19.5 L54.5 23.5 Z', '#FFFFFF', 'front', 2.3, { opacity: 0.6 }),
    ],
  },
  {
    id: 'ski_goggles',
    label: 'Occhiali da sci',
    group: 'eyes',
    parts: [
      fill('M30 18.5 H70 V24 H30 Z', '#2E86C1', 'wrap', 26),
      fill(roundedRect(33, 14, 34, 16, 5), BLACK, 'front', 3),
      fill(roundedRect(35.5, 16, 29, 12, 3.5), '#F39C12', 'front', 3.5, { metal: true }),
      fill('M38 18 L44 18 L38.5 24 Z', '#FFFFFF', 'front', 3.8, { opacity: 0.7 }),
    ],
  },
  {
    id: 'tie',
    label: 'Cravatta',
    group: 'neck',
    parts: [
      fill('M47.5 44.5 H52.5 L56 66 L50 72.5 L44 66 Z', '#24427A', 'front', 3),
      fill('M46.8 50 L53.4 46.2 L53.8 48.7 L47.2 52.5 Z M46 57.5 L54.5 52.7 L54.9 55.2 L46.4 60 Z', GOLD, 'front', 3.3),
      fill('M46 39 H54 L52.5 44.5 H47.5 Z', '#18305C', 'front', 3.6),
    ],
  },
  {
    id: 'bow_tie',
    label: 'Papillon',
    group: 'neck',
    parts: [
      fill(
        'M50 41.5 L40.5 36 C39 36 38.5 37 38.5 38 V45 C38.5 46 39 47 40.5 47 Z ' +
          'M50 41.5 L59.5 36 C61 36 61.5 37 61.5 38 V45 C61.5 46 61 47 59.5 47 Z',
        BLACK,
        'front',
        3,
      ),
      fill(
        `${circle(42.5, 39.5, 1)} ${circle(43, 44, 1)} ${circle(57.5, 39.5, 1)} ${circle(57, 44, 1)}`,
        WHITE,
        'front',
        3.3,
      ),
      fill(circle(50, 41.5, 2.8), '#3A3533', 'front', 4),
    ],
  },
  {
    id: 'scarf',
    label: 'Sciarpa',
    group: 'neck',
    parts: [
      fill('M35 35.5 C42 39 58 39 65 35.5 L66 42 C58 45.5 42 45.5 34 42 Z', '#C0392B', 'wrap', 28),
      fill('M56 41 L63 41 L65 61 L58 62 Z', '#C0392B', 'front', 4),
      fill('M56.6 47 L63.6 46.5 L63.9 49.5 L56.9 50 Z M57.3 54 L64.3 53.5 L64.6 56.5 L57.6 57 Z', WHITE, 'front', 4.4),
      stroke('M58.6 62 L58.8 65 M60.8 61.8 L61 64.8 M63 61.4 L63.2 64.4', '#C0392B', 'front', 1.2),
    ],
  },
  {
    id: 'crossbody_bag',
    label: 'Borsa a tracolla',
    group: 'carry',
    parts: [
      stroke('M63 39 L37 70', '#6D4C41', 'front', 3),
      fill(roundedRect(24, 64, 18, 16, 3), '#8D5A3B', 'front', 6),
      fill('M24 67 A3 3 0 0 1 27 64 H39 A3 3 0 0 1 42 67 V71 C38 74 28 74 24 71 Z', '#6D4C41', 'front', 6.6),
      fill(circle(33, 72.5, 1.6), GOLD, 'front', 7.2, { metal: true }),
    ],
  },
  {
    id: 'school_backpack',
    label: 'Zainetto',
    group: 'carry',
    parts: [
      fill(roundedRect(26, 40, 48, 42, 6), '#2E86C1', 'back', 22),
      fill('M36.5 39 H41.5 L40.5 66 H36 Z', '#F4C542', 'front', 3),
      fill('M58.5 39 H63.5 L64 66 H59.5 Z', '#F4C542', 'front', 3),
    ],
  },
]

export const ACCESSORY_BY_ID = new Map(ACCESSORIES.map((a) => [a.id, a]))

export function accessoryLabel(id: AccessoryId | null | undefined): string {
  return (id && ACCESSORY_BY_ID.get(id)?.label) || 'Nessun accessorio'
}
