import { useEffect, useRef, useState } from 'react'
import type { Mode, UserState } from '../shared/types'
import { emptyUserState } from '../shared/types'
import { getVoice } from '../shared/voices'
import { Composer } from './components/Composer'
import { Portrait } from './components/Portrait'
import { Scene } from './components/Scene'
import { respond } from './lib/api'
import { clearState, loadState, saveState } from './lib/db'

export default function App() {
	const [state, setState] = useState<UserState | null>(null)
	const [loading, setLoading] = useState(false)
	const [animating, setAnimating] = useState(false)
	const [animateIndex, setAnimateIndex] = useState<number | null>(null)
	const [activeVoiceId, setActiveVoiceId] = useState<string>('rhetor')
	const [mode, setMode] = useState<Mode>('default')
	const [error, setError] = useState<string | null>(null)
	const transcriptRef = useRef<HTMLDivElement>(null)
	const booted = useRef(false)

	// Boot: load saved state or open with the hook.
	useEffect(() => {
		if (booted.current) return
		booted.current = true
		;(async () => {
			const saved = await loadState()
			if (saved && saved.history.length > 0) {
				setState(saved)
				const lastScene = [...saved.history].reverse().find((t) => t.role === 'voices')
				if (lastScene && lastScene.role === 'voices' && lastScene.scene[0]) {
					setActiveVoiceId(lastScene.scene[0].voice)
				}
			} else {
				await openHook()
			}
		})()
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [])

	useEffect(() => {
		const el = transcriptRef.current
		if (el) el.scrollTop = el.scrollHeight
	}, [state, animating])

	async function openHook() {
		setLoading(true)
		setError(null)
		try {
			const res = await respond(emptyUserState(), '', mode)
			await saveState(res.userState)
			setState(res.userState)
			setAnimateIndex(res.userState.history.length - 1)
			setAnimating(true)
		} catch (e) {
			setError(String(e))
		} finally {
			setLoading(false)
		}
	}

	async function send(text: string) {
		if (!state || loading) return
		// optimistic: show the user's line immediately
		const optimistic: UserState = {
			...state,
			history: [...state.history, { role: 'user', content: text }],
		}
		setState(optimistic)
		setLoading(true)
		setError(null)
		try {
			const res = await respond(state, text, mode)
			await saveState(res.userState)
			setState(res.userState)
			setAnimateIndex(res.userState.history.length - 1)
			setAnimating(true)
		} catch (e) {
			setError(String(e))
			setState(state) // roll back the optimistic turn
		} finally {
			setLoading(false)
		}
	}

	async function reset() {
		await clearState()
		setState(null)
		setAnimateIndex(null)
		setActiveVoiceId('rhetor')
		booted.current = false
		await openHook()
		booted.current = true
	}

	const activeVoice = getVoice(activeVoiceId) ?? getVoice('rhetor')!
	const busy = loading || animating

	return (
		<div className="app">
			<aside className="stage">
				<Portrait voice={activeVoice} size={200} />
				<div className="stage-name" style={{ color: activeVoice.color }}>
					{activeVoice.name}
				</div>
				<div className="stage-role">{activeVoice.function}</div>
				{state && (
					<div className="phase-tag">
						{state.phase === 'onboarding' ? 'знакомство' : `хор · ${state.activeCast.length}`}
					</div>
				)}
			</aside>

			<main className="main">
				<header className="topbar">
					<span className="logo">ХОР</span>
					<div className="controls">
						<button
							className={mode === 'deep' ? 'on' : ''}
							title="Жирная сцена (Opus)"
							onClick={() => setMode((m) => (m === 'deep' ? 'default' : 'deep'))}
						>
							{mode === 'deep' ? 'глубже ●' : 'глубже ○'}
						</button>
						<button title="Начать заново" onClick={reset}>
							↺
						</button>
					</div>
				</header>

				<div className="transcript" ref={transcriptRef}>
					{state?.history.map((turn, i) => {
						if (turn.role === 'user') {
							return (
								<div className="user-turn" key={i}>
									{turn.content}
								</div>
							)
						}
						return (
							<Scene
								key={i}
								scene={turn.scene}
								animate={i === animateIndex}
								onVoiceChange={setActiveVoiceId}
								onComplete={() => {
									if (i === animateIndex) setAnimating(false)
								}}
							/>
						)
					})}
					{loading && <div className="thinking">…</div>}
					{error && <div className="error">{error}</div>}
				</div>

				<Composer disabled={busy || !state} onSend={send} />
			</main>
		</div>
	)
}
