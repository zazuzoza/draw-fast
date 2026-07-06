// The assembled chorus, one small portrait per filled archetypal slot.
// New voices mount with the portrait's «проступание» animation — this is where
// the user *sees* the cast being assembled during onboarding.

import type { CastSlot } from '../../shared/types'
import { getVoice } from '../../shared/voices'
import { Portrait } from './Portrait'

export function CastStrip({ cast, activeVoiceId }: { cast: CastSlot[]; activeVoiceId: string }) {
	if (cast.length <= 1) return null
	return (
		<div className="cast-strip">
			{cast.map((slot) => {
				const voice = getVoice(slot.voice)
				if (!voice) return null
				const active = voice.id === activeVoiceId
				return (
					<div
						key={slot.archetype}
						className={active ? 'cast-chip active' : 'cast-chip'}
						title={voice.name}
					>
						<Portrait voice={voice} size={44} />
					</div>
				)
			})}
		</div>
	)
}
