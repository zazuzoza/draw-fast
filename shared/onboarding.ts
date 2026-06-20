// The fixed opening move (онбординг §5). One sharp, projective question with answer
// chips — a memorable «door» that is also diagnostic: *whom* you'd strike reveals what
// you are in conflict with, which seeds the casting director (especially shadow slots).
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
	question:
		'Давай без предисловий. Будь у тебя заточенная палка — и ни последствий, ни суда — кого бы ты ею убил?',
	options: [
		{ id: 'self', label: 'Себя. Чего уж там.', reveals: 'аутоагрессия, тяжёлый внутренний критик' },
		{
			id: 'breaker',
			label: 'Того, кто меня сломал.',
			reveals: 'незажившая рана, обида, подорванное доверие',
		},
		{
			id: 'unbecome',
			label: 'Того, кем я так и не стал.',
			reveals: 'непрожитое, сожаление, саботаж себя',
		},
		{
			id: 'asker',
			label: 'Тебя. За такие вопросы.',
			reveals: 'дерзость, проверка рамки, не даётся в руки',
		},
		{
			id: 'boredom',
			label: 'Скуку. Будь у неё горло.',
			reveals: 'жажда интенсивности, бежит от пресного',
		},
		{
			id: 'none',
			label: 'Никого. Палку бы сломал.',
			reveals: 'уклонение, контроль, держит дистанцию',
		},
	],
}
