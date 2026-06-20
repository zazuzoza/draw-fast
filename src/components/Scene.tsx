// A scene = one or more lines, revealed sequentially with a pause between voices (ТЗ §8).

import { useEffect, useState } from 'react'
import type { SceneLine } from '../../shared/types'
import { getVoice } from '../../shared/voices'
import { VoiceLine } from './VoiceLine'

const PAUSE_BETWEEN = 320 // ms between voices

export function Scene({
	scene,
	animate,
	onVoiceChange,
	onComplete,
}: {
	scene: SceneLine[]
	animate: boolean
	onVoiceChange?: (voiceId: string) => void
	onComplete?: () => void
}) {
	// How many lines are revealed. When not animating, all of them.
	const [revealed, setRevealed] = useState(animate ? 1 : scene.length)

	useEffect(() => {
		if (animate && scene.length > 0) onVoiceChange?.(scene[0].voice)
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [])

	const advance = (index: number) => {
		if (index + 1 >= scene.length) {
			onComplete?.()
			return
		}
		setTimeout(() => {
			const next = index + 1
			onVoiceChange?.(scene[next].voice)
			setRevealed((r) => Math.max(r, next + 1))
		}, PAUSE_BETWEEN)
	}

	return (
		<div className="scene">
			{scene.slice(0, revealed).map((line, i) => {
				const voice = getVoice(line.voice) ?? fallbackVoice(line.voice)
				const isLast = i === scene.length - 1
				const lineAnimates = animate && i === revealed - 1
				return (
					<VoiceLine
						key={i}
						voice={voice}
						text={line.line}
						intensity={line.intensity}
						animate={lineAnimates}
						onDone={() => {
							if (animate) advance(i)
							else if (isLast) onComplete?.()
						}}
					/>
				)
			})}
		</div>
	)
}

function fallbackVoice(id: string) {
	return {
		id,
		name: id,
		function: '',
		lens: '',
		register: '',
		personality: '',
		cadence: '',
		color: '#e8c34a',
		affinities: [],
	}
}
