// One spoken line with a typewriter reveal (~30–50 chars/s, ТЗ §8).

import { useEffect, useRef, useState } from 'react'
import type { Intensity, Voice } from '../../shared/types'

const CHARS_PER_SEC = 42

const SIZE: Record<Intensity, string> = {
	whisper: 'line-whisper',
	normal: 'line-normal',
	shout: 'line-shout',
}

export function VoiceLine({
	voice,
	text,
	intensity = 'normal',
	animate,
	onDone,
}: {
	voice: Voice
	text: string
	intensity?: Intensity
	animate: boolean
	onDone?: () => void
}) {
	const [shown, setShown] = useState(animate ? '' : text)
	const doneRef = useRef(onDone)
	doneRef.current = onDone

	useEffect(() => {
		if (!animate) {
			setShown(text)
			return
		}
		setShown('')
		let i = 0
		const step = 1000 / CHARS_PER_SEC
		const timer = setInterval(() => {
			i++
			setShown(text.slice(0, i))
			if (i >= text.length) {
				clearInterval(timer)
				doneRef.current?.()
			}
		}, step)
		return () => clearInterval(timer)
	}, [text, animate])

	return (
		<div className={`voice-line ${SIZE[intensity]}`}>
			<span className="voice-name" style={{ color: voice.color }}>
				{voice.name}
			</span>
			<span className="voice-text" style={{ textShadow: `0 0 8px ${voice.color}44` }}>
				{shown}
				{animate && shown.length < text.length ? <span className="caret">▌</span> : null}
			</span>
		</div>
	)
}
