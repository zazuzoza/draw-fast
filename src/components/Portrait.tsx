// Procedural placeholder portrait (ТЗ §8–9). Real Midjourney art replaces this later;
// the *развёртка* (mono-amber + halftone/grain + scanlines) is what unifies the cast.
// Each voice gets a deterministic abstract bust in its own colour.

import { useMemo } from 'react'
import type { Intensity, Voice } from '../../shared/types'

function hashString(s: string): number {
	let h = 2166136261
	for (let i = 0; i < s.length; i++) {
		h ^= s.charCodeAt(i)
		h = Math.imul(h, 16777619)
	}
	return h >>> 0
}

function mulberry32(seed: number) {
	let a = seed
	return () => {
		a |= 0
		a = (a + 0x6d2b79f5) | 0
		let t = Math.imul(a ^ (a >>> 15), 1 | a)
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296
	}
}

const SCALE: Record<Intensity, number> = {
	whisper: 0.82,
	normal: 1,
	shout: 1.18,
}

export function Portrait({
	voice,
	intensity = 'normal',
	size = 180,
}: {
	voice: Voice
	intensity?: Intensity
	size?: number
}) {
	const halftone = useMemo(() => {
		const rng = mulberry32(hashString(voice.id))
		const dots: { x: number; y: number; r: number }[] = []
		// silhouette-confined speckle for a risograph/halftone feel
		for (let i = 0; i < 90; i++) {
			const x = 10 + rng() * 80
			const y = 10 + rng() * 80
			dots.push({ x, y, r: 0.6 + rng() * 1.8 })
		}
		return dots
	}, [voice.id])

	const s = SCALE[intensity]
	const initial = voice.name.charAt(0)

	return (
		<div
			className="portrait"
			style={{ width: size * s, height: size * s, borderColor: voice.color }}
		>
			<svg viewBox="0 0 100 120" width="100%" height="100%" preserveAspectRatio="xMidYMid slice">
				<defs>
					<radialGradient id={`g-${voice.id}`} cx="50%" cy="38%" r="70%">
						<stop offset="0%" stopColor={voice.color} stopOpacity="0.55" />
						<stop offset="100%" stopColor="#0d0d0b" stopOpacity="0.95" />
					</radialGradient>
					<clipPath id={`c-${voice.id}`}>
						<rect x="0" y="0" width="100" height="120" />
					</clipPath>
				</defs>
				<g clipPath={`url(#c-${voice.id})`}>
					<rect x="0" y="0" width="100" height="120" fill="#0d0d0b" />
					{/* shoulders */}
					<path
						d="M8 120 C12 90 30 84 50 84 C70 84 88 90 92 120 Z"
						fill={`url(#g-${voice.id})`}
						stroke={voice.color}
						strokeWidth="1"
						strokeOpacity="0.5"
					/>
					{/* head */}
					<ellipse
						cx="50"
						cy="48"
						rx="24"
						ry="30"
						fill={`url(#g-${voice.id})`}
						stroke={voice.color}
						strokeWidth="1.2"
						strokeOpacity="0.7"
					/>
					{/* halftone speckle */}
					{halftone.map((d, i) => (
						<circle key={i} cx={d.x} cy={d.y} r={d.r} fill={voice.color} opacity="0.18" />
					))}
					<text
						x="50"
						y="55"
						textAnchor="middle"
						fontSize="26"
						fontFamily="Georgia, serif"
						fill={voice.color}
						opacity="0.85"
					>
						{initial}
					</text>
				</g>
			</svg>
			<div className="portrait-scan" />
		</div>
	)
}
