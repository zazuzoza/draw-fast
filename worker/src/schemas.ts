// Zod validation for tool outputs (ТЗ §7.4). Worker validates, retries once, then falls back.

import { z } from 'zod'

export const sceneLineSchema = z.object({
	voice: z.string().min(1),
	line: z.string().min(1),
	intensity: z.enum(['whisper', 'normal', 'shout']).default('normal'),
})

export const speakSchema = z.object({
	scene: z.array(sceneLineSchema).min(1).max(7),
})

export const profileSchema = z.object({
	summary: z.string(),
	drives: z.array(z.string()),
	defenses: z.array(z.string()),
	texture: z.string(),
})

export const castSlotSchema = z.object({
	archetype: z.string(),
	voice: z.string(),
})

export const castUpdateSchema = z.object({
	profile: profileSchema,
	activeCast: z.array(castSlotSchema),
	phase: z.enum(['onboarding', 'live']),
	introduce: z.object({ voice: z.string(), archetype: z.string() }).nullable(),
})

export type SpeakOutput = z.infer<typeof speakSchema>
export type CastUpdateOutput = z.infer<typeof castUpdateSchema>
