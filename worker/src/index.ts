// Cloudflare Worker — POST /respond (ТЗ §6).
// Orchestrates the two model roles: casting director (analysis) then executor (voices).

import type {
	CastSlot,
	Mode,
	RespondRequest,
	RespondResponse,
	SceneLine,
	Turn,
	UserState,
} from '../../shared/types'
import { ARCHETYPES, getArchetype } from '../../shared/archetypes'
import { ALL_VOICES, getVoice } from '../../shared/voices'
import { callTool, type AnthropicMessage } from './anthropic'
import {
	CAST_UPDATE_TOOL,
	castingSystem,
	executorSystem,
	onboardingSystem,
	SPEAK_TOOL,
	type CastMember,
} from './prompts'
import { castUpdateSchema, speakSchema, type CastUpdateOutput } from './schemas'

type Introduce = { voice: string; archetype: string } | null

/** Onboarding wraps up once the chorus is assembled or after this many user turns. */
const ONBOARDING_SOFT_CAP = 6

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

	// Onboarding starts with just the host in the Hero slot; the chorus assembles
	// the other archetypal slots from there (ТЗ §5 + архетипы Биби).
	if (!state.activeCast?.length) {
		state.activeCast =
			state.phase === 'live'
				? fillEmptySlots([{ archetype: 'hero', voice: 'rhetor' }])
				: [{ archetype: 'hero', voice: 'rhetor' }]
	}

	const isOpening = state.history.length === 0 && !message

	if (message) state.history.push({ role: 'user', content: message })

	// 1. Casting director — updates profile / slot assignments / phase.
	let introduce: Introduce = null
	if (shouldCast(state, isOpening)) {
		const update = await runCasting(state, env)
		state.profile = update.profile
		state.phase = update.phase
		introduce = update.introduce
		let cast = sanitizeAssignments(update.activeCast, introduce)

		if (state.phase === 'onboarding') {
			const userTurns = countUserTurns(state)
			// Soft cap: fill any remaining slots so onboarding can't drag on.
			if (userTurns >= ONBOARDING_SOFT_CAP) cast = fillEmptySlots(cast)
			// Move to live once every slot is filled and nobody is mid-introduction
			// (the introducing turn itself stays onboarding so Ритор can welcome them).
			if (cast.length >= ARCHETYPES.length && !introduce) state.phase = 'live'
		}
		// In live every archetypal slot must be filled.
		if (state.phase === 'live') cast = fillEmptySlots(cast)
		state.activeCast = cast
	}

	// 2. Executor — the scene.
	const scene = await runExecutor(state, introduce, mode, env)
	state.history.push({ role: 'voices', scene })

	const result: RespondResponse = { userState: state, scene }
	return json(result, 200)
}

function countUserTurns(state: UserState): number {
	return state.history.filter((t) => t.role === 'user').length
}

/** Casting runs densely in onboarding, sparsely in live (ТЗ §2). */
function shouldCast(state: UserState, isOpening: boolean): boolean {
	if (isOpening) return false
	if (state.phase === 'onboarding') return true
	return countUserTurns(state) % 4 === 0
}

// Normalise the director's slot assignments: known archetype + voice only, one voice
// per slot and one slot per voice, ordered by archetype. The introduced slot wins; the
// Hero slot is guaranteed (defaults to rhetor) so there is always a host.
function sanitizeAssignments(slots: CastSlot[], introduce: Introduce): CastSlot[] {
	const byArchetype = new Map<string, string>()
	const usedVoices = new Set<string>()
	const put = (archetype: string, voice: string) => {
		if (!getArchetype(archetype) || !getVoice(voice)) return
		if (byArchetype.has(archetype) || usedVoices.has(voice)) return
		byArchetype.set(archetype, voice)
		usedVoices.add(voice)
	}
	if (introduce) put(introduce.archetype, introduce.voice)
	for (const s of slots) put(s.archetype, s.voice)
	if (!byArchetype.has('hero') && !usedVoices.has('rhetor')) put('hero', 'rhetor')
	return assignmentList(byArchetype)
}

// Fill every still-empty archetypal slot with the best unused voice by affinity.
function fillEmptySlots(slots: CastSlot[]): CastSlot[] {
	const byArchetype = new Map(slots.map((s) => [s.archetype, s.voice]))
	const usedVoices = new Set(slots.map((s) => s.voice))
	for (const a of ARCHETYPES) {
		if (byArchetype.has(a.id)) continue
		const pick =
			ALL_VOICES.find((v) => v.affinities.includes(a.id) && !usedVoices.has(v.id)) ??
			ALL_VOICES.find((v) => !usedVoices.has(v.id))
		if (pick) {
			byArchetype.set(a.id, pick.id)
			usedVoices.add(pick.id)
		}
	}
	return assignmentList(byArchetype)
}

function assignmentList(byArchetype: Map<string, string>): CastSlot[] {
	return ARCHETYPES.filter((a) => byArchetype.has(a.id)).map((a) => ({
		archetype: a.id,
		voice: byArchetype.get(a.id)!,
	}))
}

async function runCasting(state: UserState, env: Env): Promise<CastUpdateOutput> {
	const system = castingSystem()
	const messages: AnthropicMessage[] = [{ role: 'user', content: castingInput(state) }]
	const fallback: CastUpdateOutput = {
		profile: state.profile,
		activeCast: state.activeCast,
		phase: state.phase,
		introduce: null,
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
	introduce: Introduce,
	mode: Mode,
	env: Env
): Promise<SceneLine[]> {
	const isOnboarding = state.phase === 'onboarding'
	const members = castMembers(state)
	const introMember = resolveIntroduce(introduce)
	const system = isOnboarding
		? onboardingSystem(introMember)
		: executorSystem(members, state.profile)

	const messages = buildExecutorMessages(state.history)
	const model = mode === 'deep' ? EXECUTOR_DEEP : EXECUTOR_DEFAULT
	// Onboarding speaks as the host (Hero slot); live falls back to any member.
	const fallbackVoice = isOnboarding
		? (heroVoiceId(state) ?? 'rhetor')
		: (members[0]?.voice.id ?? 'razor')

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

// Resolve the slot assignments into {voice, archetype} members, dropping any unknown ids.
function castMembers(state: UserState): CastMember[] {
	const members: CastMember[] = []
	for (const slot of state.activeCast) {
		const voice = getVoice(slot.voice)
		const archetype = getArchetype(slot.archetype)
		if (voice && archetype) members.push({ voice, archetype })
	}
	return members
}

function heroVoiceId(state: UserState): string | null {
	return state.activeCast.find((s) => s.archetype === 'hero')?.voice ?? null
}

function resolveIntroduce(introduce: Introduce): CastMember | null {
	if (!introduce) return null
	const voice = getVoice(introduce.voice)
	const archetype = getArchetype(introduce.archetype)
	return voice && archetype ? { voice, archetype } : null
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
