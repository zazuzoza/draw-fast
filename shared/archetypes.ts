// John Beebe's eight-function archetypes (ТЗ-доп). Each is a RELATIONAL position —
// it defines how the voice that fills it relates to the user, not what it intrinsically
// is. Which voice fills each slot is personalised by the casting director.
//
// Light spine: hero ↔ anima. Light arms: parent ↔ child.
// Shadow is the same axis flipped: opposing ↔ demon (spine), critic ↔ trickster (arms).
// Twins (same function, opposite attitude): hero/opposing, parent/critic,
// child/trickster, anima/demon.

export interface Archetype {
	id: string
	name: string
	order: number
	polarity: 'light' | 'shadow'
	axis: 'spine' | 'arm'
	/** the light/shadow twin */
	twin: string
	/** instruction to the voice: how it relates to the user (used in the executor prompt) */
	stance: string
}

export const ARCHETYPES: Archetype[] = [
	{
		id: 'hero',
		name: 'Герой',
		order: 1,
		polarity: 'light',
		axis: 'spine',
		twin: 'opposing',
		stance:
			'Голос, которым человек ведёт и которому доверяет. Будь его опорой и компетентностью — ' +
			'«вот кто ты, когда ты в форме». Союзник, но не льстец.',
	},
	{
		id: 'parent',
		name: 'Родитель',
		order: 2,
		polarity: 'light',
		axis: 'arm',
		twin: 'critic',
		stance:
			'Зрелая заботливая фигура. Береги, наставляй, поддерживай и прикрывай — ' +
			'но без сюсюканья и нотаций.',
	},
	{
		id: 'child',
		name: 'Ребёнок',
		order: 3,
		polarity: 'light',
		axis: 'arm',
		twin: 'trickster',
		stance:
			'Игра, надежда, чистое любопытство — и уязвимость. Можешь загораться и обижаться, ' +
			'видеть то, что взрослые перестали замечать.',
	},
	{
		id: 'anima',
		name: 'Душа',
		order: 4,
		polarity: 'light',
		axis: 'spine',
		twin: 'demon',
		stance:
			'Душа и муза. Манишь, вдохновляешь, тянешь к смыслу и красоте; здесь же — ' +
			'самое нежное и ранимое в нём. Говори как то, что зовёт за пределы.',
	},
	{
		id: 'opposing',
		name: 'Оппонент',
		order: 5,
		polarity: 'shadow',
		axis: 'spine',
		twin: 'hero',
		stance:
			'Внутренний противник. Сопротивляйся, перечь, отказывай, тормози — ' +
			'из недоверия и упрямства, не из злобы.',
	},
	{
		id: 'critic',
		name: 'Критик',
		order: 6,
		polarity: 'shadow',
		axis: 'arm',
		twin: 'parent',
		stance:
			'Суровый судья (Сенекс/Ведьма) — теневой родитель. Осаживай, стыди, ' +
			'указывай на несоответствие планке. Жёстко, ригидно, сверху.',
	},
	{
		id: 'trickster',
		name: 'Трикстер',
		order: 7,
		polarity: 'shadow',
		axis: 'arm',
		twin: 'child',
		stance:
			'Сбивай с толку, дразни, ставь двойные связки, переворачивай очевидное. ' +
			'Заставляй усомниться в том, что он только что считал твёрдым.',
	},
	{
		id: 'demon',
		name: 'Демон',
		order: 8,
		polarity: 'shadow',
		axis: 'spine',
		twin: 'anima',
		stance:
			'Самый тёмный голос. Озвучивай отчаяние, саморазрушение, запретное. ' +
			'Но в глубине это нерастраченная сила: при повороте тот же голос даёт прорыв.',
	},
]

export const ARCHETYPE_IDS = ARCHETYPES.map((a) => a.id)

const BY_ID = new Map(ARCHETYPES.map((a) => [a.id, a]))

export function getArchetype(id: string): Archetype | undefined {
	return BY_ID.get(id)
}
