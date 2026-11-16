import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ApiError, api } from './client'
import type {
  AppConfig,
  ExclusionGroup,
  Invite,
  Lottery,
  Me,
  MyAssignment,
  RedeemResult,
  RoomDetail,
  RoomInput,
  RoomSummary,
} from './types'

export const keys = {
  config: ['config'] as const,
  me: ['me'] as const,
  rooms: ['rooms'] as const,
  room: (id: string) => ['rooms', id] as const,
  assignment: (id: string) => ['rooms', id, 'assignment'] as const,
  lottery: (id: string) => ['rooms', id, 'lottery'] as const,
}

export function useConfig() {
  return useQuery({
    queryKey: keys.config,
    queryFn: () => api<AppConfig>('/config'),
    staleTime: Infinity,
  })
}

export function useMe() {
  return useQuery({
    queryKey: keys.me,
    queryFn: async () => {
      try {
        return await api<Me>('/me')
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) return null
        throw error
      }
    },
    staleTime: 5 * 60_000,
  })
}

export function useLogin() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (input: { credential: string } | { email: string; name: string }) =>
      'credential' in input
        ? api<Me>('/auth/google', { method: 'POST', body: input })
        : api<Me>('/auth/dev-login', { method: 'POST', body: input }),
    onSuccess: (me) => {
      // Niente clear(): rimuoverebbe anche la query `me` che il layout sta osservando.
      client.removeQueries({ queryKey: keys.rooms })
      client.setQueryData(keys.me, me)
    },
  })
}

export function useLogout() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: () => api<void>('/auth/logout', { method: 'POST' }),
    onSuccess: () => {
      client.removeQueries({ queryKey: keys.rooms })
      client.setQueryData(keys.me, null)
    },
  })
}

export function useUpdateMe() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (input: Partial<Pick<Me, 'name' | 'bio' | 'color' | 'accessory'>>) =>
      api<Me>('/me', { method: 'PATCH', body: input }),
    onSuccess: (me) => {
      client.setQueryData(keys.me, me)
      // Nome e colore compaiono anche nelle stanze.
      client.invalidateQueries({ queryKey: keys.rooms })
    },
  })
}

export function useRooms() {
  return useQuery({ queryKey: keys.rooms, queryFn: () => api<RoomSummary[]>('/rooms') })
}

export function useRoom(id: string) {
  return useQuery({
    queryKey: keys.room(id),
    queryFn: () => api<RoomDetail>(`/rooms/${id}`),
    retry: (count, error) => !(error instanceof ApiError && error.status === 404) && count < 2,
  })
}

export function useMyAssignment(id: string, enabled: boolean) {
  return useQuery({
    queryKey: keys.assignment(id),
    queryFn: () => api<MyAssignment>(`/rooms/${id}/my-assignment`),
    enabled,
  })
}

function useRoomMutation<TInput, TResult = RoomDetail>(
  id: string,
  request: (input: TInput) => Promise<TResult>,
) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: request,
    onSuccess: (result) => {
      if (result && typeof result === 'object' && 'participants' in result) {
        client.setQueryData(keys.room(id), result)
      }
      client.invalidateQueries({ queryKey: keys.room(id) })
      client.invalidateQueries({ queryKey: keys.rooms, exact: true })
    },
  })
}

export function useCreateRoom() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (input: RoomInput) => api<RoomDetail>('/rooms', { method: 'POST', body: input }),
    onSuccess: (room) => {
      client.setQueryData(keys.room(room.id), room)
      client.invalidateQueries({ queryKey: keys.rooms, exact: true })
    },
  })
}

export function useUpdateRoom(id: string) {
  return useRoomMutation(id, (input: Partial<RoomInput>) =>
    api<RoomDetail>(`/rooms/${id}`, { method: 'PATCH', body: input }),
  )
}

export function useDeleteRoom(id: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: () => api<void>(`/rooms/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      client.removeQueries({ queryKey: keys.room(id) })
      client.invalidateQueries({ queryKey: keys.rooms, exact: true })
    },
  })
}

export function useRemoveParticipant(id: string) {
  return useRoomMutation(id, (userId: string) =>
    api<void>(`/rooms/${id}/participants/${userId}`, { method: 'DELETE' }),
  )
}

export function useCreateInvite(id: string) {
  return useMutation({
    mutationFn: () => api<Invite>(`/rooms/${id}/invites`, { method: 'POST' }),
  })
}

export function useRedeemInvite() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (code: string) =>
      api<RedeemResult>('/invites/redeem', { method: 'POST', body: { code } }),
    onSuccess: () => client.invalidateQueries({ queryKey: keys.rooms }),
  })
}

export function useSaveExclusion(id: string) {
  return useRoomMutation(id, (group: Omit<ExclusionGroup, 'id'> & { id?: string }) =>
    group.id
      ? api<ExclusionGroup>(`/rooms/${id}/exclusions/${group.id}`, {
          method: 'PUT',
          body: { name: group.name, member_ids: group.member_ids },
        })
      : api<ExclusionGroup>(`/rooms/${id}/exclusions`, {
          method: 'POST',
          body: { name: group.name, member_ids: group.member_ids },
        }),
  )
}

export function useDeleteExclusion(id: string) {
  return useRoomMutation(id, (groupId: string) =>
    api<void>(`/rooms/${id}/exclusions/${groupId}`, { method: 'DELETE' }),
  )
}

export function useDraw(id: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (action: 'draw' | 'cancel') =>
      api<RoomDetail>(`/rooms/${id}/draw`, { method: action === 'draw' ? 'POST' : 'DELETE' }),
    onSuccess: (room) => {
      client.setQueryData(keys.room(id), room)
      client.invalidateQueries({ queryKey: keys.assignment(id) })
      client.invalidateQueries({ queryKey: keys.rooms, exact: true })
    },
  })
}

export function useLottery(id: string) {
  return useQuery({
    queryKey: keys.lottery(id),
    queryFn: () => api<Lottery | null>(`/rooms/${id}/lottery`),
  })
}

/** Le azioni sulla lotteria rispondono con lo stato nuovo (il WebSocket lo manda anche agli altri). */
function useLotteryMutation<TInput = void>(
  id: string,
  request: (input: TInput) => Promise<Lottery | void>,
) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: request,
    onSuccess: (lottery) => {
      client.setQueryData(keys.lottery(id), lottery ?? null)
    },
  })
}

export function useCreateLottery(id: string) {
  return useLotteryMutation(id, () => api<Lottery>(`/rooms/${id}/lottery`, { method: 'POST' }))
}

export function useOpenLottery(id: string) {
  return useLotteryMutation(id, () =>
    api<Lottery>(`/rooms/${id}/lottery/open`, { method: 'POST' }),
  )
}

export function useDeleteLottery(id: string) {
  return useLotteryMutation(id, () => api<void>(`/rooms/${id}/lottery`, { method: 'DELETE' }))
}

export function useTakeTicket(id: string) {
  return useLotteryMutation(id, () =>
    api<Lottery>(`/rooms/${id}/lottery/tickets`, { method: 'POST' }),
  )
}

export function useDrawLottery(id: string) {
  return useLotteryMutation(id, () =>
    api<Lottery>(`/rooms/${id}/lottery/draw`, { method: 'POST' }),
  )
}
