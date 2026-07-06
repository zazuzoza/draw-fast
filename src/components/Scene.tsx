// A scene = one or more lines, revealed sequentially with a pause between voices (ТЗ §8).
// When `animate` flips to false mid-scene (user skip), every line shows at once.

import { useEffect, useRef, useState } from 'react'
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
	const [revealed, setRevealed] = useState(1)
	const animateRef = useRef(animate)
	animateRef.current = animate
	// When not animating (history reload or skip), everything is visible.
	const visible = animate ? revealed : scene.length

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
			if (!animateRef.current) return // skipped meanwhile
			const next = index + 1
			onVoiceChange?.(scene[next].voice)
			setRevealed((r) => Math.max(r, next + 1))
		}, PAUSE_BETWEEN)
	}

	return (
		<div className="scene">
			{scene.slice(0, visible).map((line, i) => {
				const voice = getVoice(line.voice) ?? fallbackVoice(line.voice)
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
