// Client → Worker. The whole UserState travels in every request (ТЗ §3, §6).

import type { Mode, RespondRequest, RespondResponse, UserState } from '../../shared/types'

// Override with VITE_API_BASE for a deployed worker; defaults to same-origin /respond
// (Vite proxies it to wrangler in dev).
const API_BASE = (import.meta.env.VITE_API_BASE ?? '').replace(/\/$/, '')

export async function respond(
	userState: UserState,
	message: string,
	mode: Mode = 'default'
): Promise<RespondResponse> {
	const payload: RespondRequest = { userState, message, mode }
	const res = await fetch(`${API_BASE}/respond`, {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify(payload),
	})
	if (!res.ok) {
		const text = await res.text().catch(() => '')
		throw new Error(`/respond ${res.status}: ${text}`)
	}
	return (await res.json()) as RespondResponse
}
