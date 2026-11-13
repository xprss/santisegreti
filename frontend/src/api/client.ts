export class ApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

const FALLBACK_MESSAGE = 'Qualcosa è andato storto. Riproviamo tra un attimo?'

function detailToMessage(detail: unknown): string {
  if (typeof detail === 'string') return detail
  // Errori di validazione di FastAPI: lista di oggetti con `msg`.
  if (Array.isArray(detail)) return 'Qualche campo non torna: vale la pena ricontrollarlo.'
  return FALLBACK_MESSAGE
}

export async function api<T>(
  path: string,
  options: { method?: string; body?: unknown } = {},
): Promise<T> {
  const { method = 'GET', body } = options
  let response: Response
  try {
    response = await fetch(`/api${path}`, {
      method,
      credentials: 'same-origin',
      headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
  } catch {
    throw new ApiError(0, 'Sembra che la connessione sia saltata. Riproviamo?')
  }

  if (response.status === 204) return undefined as T

  const payload = await response.json().catch(() => null)
  if (!response.ok) {
    throw new ApiError(response.status, detailToMessage(payload?.detail))
  }
  return payload as T
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message
  return FALLBACK_MESSAGE
}
