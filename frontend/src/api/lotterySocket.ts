import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { keys } from './hooks'
import type { Lottery } from './types'

type ServerMessage =
  | { type: 'lottery'; lottery: Lottery | null }
  | { type: 'presence'; online: string[] }

/** Chiusure decise dal server: inutile riprovare (sessione scaduta, stanza lasciata…). */
const FINAL_CLOSE_CODES = new Set([4401, 4403, 4404])

/**
 * Il collegamento live alla lotteria della stanza: tiene aggiornata la query `lottery` (biglietti,
 * countdown, vincitore) e dice chi ha la stanza aperta in questo momento. Se cade, si ricollega
 * da solo (anche quando il telefono torna in primo piano o in rete).
 */
export function useLotterySocket(roomId: string, meId: string): Set<string> {
  const client = useQueryClient()
  const [online, setOnline] = useState<Set<string>>(() => new Set())

  useEffect(() => {
    let socket: WebSocket | null = null
    let retry: number | undefined
    let attempt = 0
    let stopped = false

    const connect = () => {
      window.clearTimeout(retry)
      if (stopped || (socket && socket.readyState <= WebSocket.OPEN)) return
      const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws'
      const ws = new WebSocket(`${protocol}://${window.location.host}/api/rooms/${roomId}/lottery/ws`)
      socket = ws

      ws.onopen = () => {
        attempt = 0
      }
      ws.onmessage = (event) => {
        const message = JSON.parse(event.data) as ServerMessage
        if (message.type === 'presence') {
          setOnline(new Set(message.online))
          return
        }
        const previous = client.getQueryData<Lottery | null>(keys.lottery(roomId))
        client.setQueryData(keys.lottery(roomId), message.lottery)
        if (message.lottery?.winner && !previous?.winner) {
          // Il vincitore ha appena indossato il premio: polaroid e scena devono vederlo.
          client.invalidateQueries({ queryKey: keys.room(roomId), exact: true })
          // E se ho vinto io, il mio profilo lo trova sbloccato e addosso.
          if (message.lottery.winner.user.id === meId) {
            client.invalidateQueries({ queryKey: keys.me })
          }
        }
      }
      ws.onclose = (event) => {
        if (socket === ws) socket = null
        setOnline(new Set())
        if (stopped || FINAL_CLOSE_CODES.has(event.code)) return
        attempt += 1
        retry = window.setTimeout(connect, Math.min(15_000, 1000 * 2 ** (attempt - 1)))
      }
    }

    const wake = () => {
      if (document.visibilityState === 'visible') connect()
    }

    connect()
    document.addEventListener('visibilitychange', wake)
    window.addEventListener('online', connect)
    return () => {
      stopped = true
      window.clearTimeout(retry)
      document.removeEventListener('visibilitychange', wake)
      window.removeEventListener('online', connect)
      socket?.close(1000)
    }
  }, [client, roomId, meId])

  return online
}
