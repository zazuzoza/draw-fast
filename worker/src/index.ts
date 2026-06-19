// Cloudflare Worker — POST /respond (ТЗ §6).
// Orchestrates the two model roles: casting director (analysis) then executor (voices).

import type {
	Mode,
	RespondRequest,
	RespondResponse,
	SceneLine,
	Turn,
	UserState,
} from '../../shared/types'
import { CORE_IDS, getVoice } from '../../shared/voices'
import { callTool, type AnthropicMessage } from './anthropic'
import {
	CAST_UPDATE_TOOL,
	castingSystem,
	executorSystem,
	onboardingSystem,
	SPEAK_TOOL,
} from './prompts'
import { castUpdateSchema, speakSchema, type CastUpdateOutput } from './schemas'

interface Env {
	ANTHROPIC_API_KEY: string
}

const EXECUTOR_DEFAULT = 'claude-sonnet-4-6'
const EXECUTOR_DEEP = 'claude-opus-4-8'
const CASTING_MODEL = 'claude-sonnet-4-6'

const CORS_HEADERS = {
	'Access-Control-Allow-Origin': '*',
	'Access-Control-Allow-Methods': 'POST, OPTIONS',
	'Access-Control-Allow-Headers': 'content-type',
}

export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		if (request.method === 'OPTIONS') {
			return new Response(null, { headers: CORS_HEADERS })
		}
		const url = new URL(request.url)
		if (request.method === 'POST' && url.pathname === '/respond') {
			return respond(request, env)
		}
		return json({ error: 'not found' }, 404)
	},
}

async function respond(request: Request, env: Env): Promise<Response> {
	if (!env.ANTHROPIC_API_KEY) {
		return json({ error: 'ANTHROPIC_API_KEY is not configured' }, 500)
	}

	let body: RespondRequest
	try {
		body = (await request.json()) as RespondRequest
	} catch {
		return json({ error: 'invalid json' }, 400)
	}

	const state = structuredClone(body.userState)
	const message = (body.message ?? '').trim()
	const mode: Mode = body.mode ?? 'default'

	// Onboarding starts with just the host; the chorus assembles from there (ТЗ §5).
	if (!state.activeCast?.length) {
		state.activeCast = state.phase === 'live' ? [...CORE_IDS] : ['rhetor']
	}

	const isOpening = state.history.length === 0 && !message

	if (message) state.history.push({ role: 'user', content: message })

	// 1. Casting director — updates profile / activeCast / phase.
	let introduceVoice: string | null = null
	if (shouldCast(state, isOpening)) {
		const update = await runCasting(state, env)
		state.profile = update.profile
		state.phase = update.phase
		introduceVoice = update.introduceVoice
		state.activeCast = sanitizeCast(update.activeCast, introduceVoice)
		// Safety net: once the cast has filled out and no one is mid-introduction,
		// move to live (the introducing turn itself stays onboarding so Ритор can
		// welcome the new voice diegetically).
		if (state.phase === 'onboarding' && state.activeCast.length >= 7 && !introduceVoice) {
			state.phase = 'live'
		}
	}

	// 2. Executor — the scene.
	const scene = await runExecutor(state, introduceVoice, mode, env)
	state.history.push({ role: 'voices', scene })

	const result: RespondResponse = { userState: state, scene }
	return json(result, 200)
}

/** Casting runs densely in onboarding, sparsely in live (ТЗ §2). */
function shouldCast(state: UserState, isOpening: boolean): boolean {
	if (isOpening) return false
	if (state.phase === 'onboarding') return true
	const userTurns = state.history.filter((t) => t.role === 'user').length
	return userTurns % 4 === 0
}

// Keep the host always present and the director's choices in order; drop unknown
// ids. We don't force the whole core in — the cast assembles over onboarding (ТЗ §5).
function sanitizeCast(ids: string[], introduce: string | null): string[] {
	const seen = new Set<string>()
	const out: string[] = []
	const push = (id: string) => {
		if (!seen.has(id) && getVoice(id)) {
			out.push(id)
			seen.add(id)
		}
	}
	push('rhetor')
	for (const id of ids) push(id)
	if (introduce) push(introduce)
	return out
}

async function runCasting(state: UserState, env: Env): Promise<CastUpdateOutput> {
	const system = castingSystem()
	const messages: AnthropicMessage[] = [{ role: 'user', content: castingInput(state) }]
	const fallback: CastUpdateOutput = {
		profile: state.profile,
		activeCast: state.activeCast,
		phase: state.phase,
		introduceVoice: null,
	}
	for (let attempt = 0; attempt < 2; attempt++) {
		try {
			const raw = await callTool({
				apiKey: env.ANTHROPIC_API_KEY,
				model: CASTING_MODEL,
				system,
				messages,
				tool: CAST_UPDATE_TOOL,
				maxTokens: 1024,
			})
			return castUpdateSchema.parse(raw)
		} catch (err) {
			if (attempt === 1) {
				console.error('casting failed, falling back:', err)
				return fallback
			}
		}
	}
	return fallback
}

function castingInput(state: UserState): string {
	const transcript = state.history
		.map((t) => {
			if (t.role === 'user') return `ПОЛЬЗОВАТЕЛЬ: ${t.content}`
			return t.scene.map((l) => `${voiceName(l.voice)}: ${l.line}`).join('\n')
		})
		.join('\n')
	return [
		`Фаза: ${state.phase}`,
		`Текущий profile: ${JSON.stringify(state.profile)}`,
		`Текущий activeCast: ${JSON.stringify(state.activeCast)}`,
		`Ходов пользователя: ${state.history.filter((t) => t.role === 'user').length}`,
		'',
		'РАЗГОВОР:',
		transcript || '(пусто)',
	].join('\n')
}

async function runExecutor(
	state: UserState,
	introduceVoice: string | null,
	mode: Mode,
	env: Env
): Promise<SceneLine[]> {
	const isOnboarding = state.phase === 'onboarding'
	const introVoice = introduceVoice ? (getVoice(introduceVoice) ?? null) : null
	const system = isOnboarding
		? onboardingSystem(introVoice)
		: executorSystem(activeVoices(state), state.profile)

	const messages = buildExecutorMessages(state.history)
	const model = mode === 'deep' ? EXECUTOR_DEEP : EXECUTOR_DEFAULT
	const fallbackVoice = isOnboarding ? 'rhetor' : 'razor'

	for (let attempt = 0; attempt < 2; attempt++) {
		try {
			const raw = await callTool({
				apiKey: env.ANTHROPIC_API_KEY,
				model,
				system,
				messages,
				tool: SPEAK_TOOL,
				maxTokens: 1024,
			})
			const parsed = speakSchema.parse(raw)
			return parsed.scene.map((l) => ({
				voice: l.voice,
				line: l.line,
				intensity: l.intensity ?? 'normal',
			}))
		} catch (err) {
			if (attempt === 1) {
				console.error('executor failed, falling back:', err)
				return [
					{
						voice: fallbackVoice,
						line: '…',
						intensity: 'whisper',
					},
				]
			}
		}
	}
	return [{ voice: fallbackVoice, line: '…', intensity: 'whisper' }]
}

function buildExecutorMessages(history: Turn[]): AnthropicMessage[] {
	const msgs: AnthropicMessage[] = history.map((t) => {
		if (t.role === 'user') return { role: 'user' as const, content: t.content }
		return {
			role: 'assistant' as const,
			content: t.scene.map((l) => `${voiceName(l.voice)}: ${l.line}`).join('\n'),
		}
	})
	// The conversation must start with a user message; the hook opens with no prior input.
	if (msgs.length === 0 || msgs[0].role === 'assistant') {
		msgs.unshift({ role: 'user', content: '[Начало разговора. Открой крючком.]' })
	}
	return msgs
}

function activeVoices(state: UserState) {
	return state.activeCast
		.map((id) => getVoice(id))
		.filter((v): v is NonNullable<typeof v> => Boolean(v))
}

function voiceName(id: string): string {
	return getVoice(id)?.name ?? id
}

function json(data: unknown, status = 200): Response {
	return new Response(JSON.stringify(data), {
		status,
		headers: { 'content-type': 'application/json', ...CORS_HEADERS },
	})
}
