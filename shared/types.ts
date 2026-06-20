// Shared types between the Cloudflare Worker (backend) and the Vite/React client.
// See ТЗ §3, §4, §6.

export type Phase = 'onboarding' | 'live'

export type Intensity = 'whisper' | 'normal' | 'shout'

export type Mode = 'default' | 'deep'

/** A voice is a point in three axes: function × lens × register (ТЗ §4). */
export interface Voice {
	id: string
	name: string
	/** what it does in the dialogue — "таранит", "утешает", "веселит"... */
	function: string
	/** what it sees — "логика", "риск", "тело"... */
	lens: string
	/** how it sounds — "холодный", "манический", "оракульный"... */
	register: string
	personality: string
	/** rhythm, length of lines */
	cadence: string
	/** display colour for frame / name (amber-family palette) */
	color: string
	/** archetypal slots (Beebe) this voice is naturally suited to fill — a hint for
	 * the casting director and the deterministic slot-filling fallback */
	affinities: string[]
	/** true for the seven core voices that anchor the roster */
	core?: boolean
}

/** The casting-director-maintained portrait of the user (ТЗ §3). */
export interface Profile {
	/** who this person is, how to talk to them */
	summary: string
	/** what drives them */
	drives: string[]
	/** how they close up */
	defenses: string[]
	/** language, rhythm, sense of humour */
	texture: string
}

/** One line in a scene returned by the executor (ТЗ §6). */
export interface SceneLine {
	voice: string
	line: string
	intensity: Intensity
}

/** A single exchange stored in history. */
export type Turn = { role: 'user'; content: string } | { role: 'voices'; scene: SceneLine[] }

/** One Beebe archetypal slot filled by a chosen voice (relational role → voice). */
export interface CastSlot {
	/** archetype id — see shared/archetypes.ts */
	archetype: string
	/** voice id filling this relational role for this user */
	voice: string
}

export interface UserState {
	phase: Phase
	profile: Profile
	/** the eight archetypal slots, each filled by a voice picked for this user.
	 * During onboarding it assembles slot by slot; in live all eight are filled. */
	activeCast: CastSlot[]
	history: Turn[]
}

export interface RespondRequest {
	userState: UserState
	message: string
	mode?: Mode
}

export interface RespondResponse {
	userState: UserState
	scene: SceneLine[]
}

export function emptyUserState(): UserState {
	return {
		phase: 'onboarding',
		profile: { summary: '', drives: [], defenses: [], texture: '' },
		activeCast: [],
		history: [],
	}
}
