// The fixed opening move (онбординг §5). One projective question with answer chips —
// a low-friction «door» that is also diagnostic: *whom* you'd pick reveals what you're
// at odds with, which seeds the casting director (especially shadow slots).
// `reveals` is a hidden note on what each choice tends to signal — for design intent and
// future casting hints; it is never shown to the user.

export interface HookOption {
	id: string
	label: string
	reveals: string
}

export interface OpeningHook {
	/** Ритор asks this first, before anything else. */
	question: string
	options: HookOption[]
}

export const OPENING_HOOK: OpeningHook = {
	question: 'Давай сразу. Будь у тебя заточенная палка — кого бы ты убил?',
	options: [
		{ id: 'self', label: 'Себя.', reveals: 'строг к себе, обращает раздражение внутрь' },
		{
			id: 'neighbor',
			label: 'Соседа сверху.',
			reveals: 'раздражает бытовое, мелкие вторжения в покой',
		},
		{ id: 'alarm', label: 'Будильник.', reveals: 'устал, не в ладах с рутиной и обязанностями' },
		{
			id: 'someone',
			label: 'Есть один на примете.',
			reveals: 'конкретный счёт к человеку, без надрыва',
		},
		{ id: 'asker', label: 'Тебя, за вопрос.', reveals: 'проверяет рамку, не даётся в руки' },
		{
			id: 'none',
			label: 'Никого, жалко палку.',
			reveals: 'уходит от прямого ответа, суховатый юмор',
		},
	],
}
