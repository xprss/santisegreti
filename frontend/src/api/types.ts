import type { AccessoryId } from '../accessories/catalog'

export type RoomStatus = 'open' | 'drawn'

export interface AppConfig {
  google_client_id: string
  dev_login: boolean
}

export interface UserPublic {
  id: string
  name: string
  bio: string
  color: string
  accessory: AccessoryId | null
  avatar_url: string | null
}

export interface Me extends UserPublic {
  email: string
  /** Accessori speciali vinti (per ora: la tunica della lotteria). */
  unlocked_accessories: AccessoryId[]
}

export interface RoomSummary {
  id: string
  name: string
  theme: string | null
  budget_eur: number
  exchange_date: string | null
  status: RoomStatus
  participant_count: number
  is_admin: boolean
}

export interface ExclusionGroup {
  id: string
  name: string
  member_ids: string[]
}

export interface RoomDetail extends RoomSummary {
  admin_id: string
  drawn_at: string | null
  participants: UserPublic[]
  exclusion_groups: ExclusionGroup[]
}

export interface RoomInput {
  name: string
  theme: string | null
  budget_eur: number
  exchange_date: string | null
}

export interface Invite {
  code: string
  expires_at: string
  expires_in: number
}

export interface RedeemResult {
  room_id: string
  already_member: boolean
}

export interface MyAssignment {
  receiver: UserPublic | null
}

/** `countdown`: estratta, ma il vincitore si scopre solo a fine conto alla rovescia. */
export type LotteryStatus = 'draft' | 'open' | 'countdown' | 'drawn'

export interface LotteryTicket {
  number: string
  taken_at: string
}

export interface Lottery {
  status: LotteryStatus
  prize: AccessoryId
  ticket_count: number
  ticket_holder_ids: string[]
  my_ticket: LotteryTicket | null
  /** Millisecondi alla rivelazione, contati dal server (solo durante il countdown). */
  countdown_ms: number | null
  winner: { user: UserPublic; number: string } | null
  opened_at: string | null
  drawn_at: string | null
}
