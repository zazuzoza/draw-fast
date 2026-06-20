// The answer chips for the fixed opening question. Picking one sends it as the first
// message; the free-text composer below stays available for those who defy the menu.

import type { HookOption } from '../../shared/onboarding'

export function OpeningChoices({
	options,
	disabled,
	onPick,
}: {
	options: HookOption[]
	disabled: boolean
	onPick: (label: string) => void
}) {
	return (
		<div className="opening-choices">
			{options.map((o) => (
				<button key={o.id} className="chip" disabled={disabled} onClick={() => onPick(o.label)}>
					{o.label}
				</button>
			))}
			<span className="opening-hint">…или впиши своё ниже.</span>
		</div>
	)
}
