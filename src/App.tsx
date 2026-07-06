import { OPENING_HOOK } from '../shared/onboarding'
import { getVoice } from '../shared/voices'
import { CastStrip } from './components/CastStrip'
import { Composer } from './components/Composer'
import { OpeningChoices } from './components/OpeningChoices'
import { Portrait } from './components/Portrait'
import { Scene } from './components/Scene'
import { useChorus } from './hooks/useChorus'
import { useEffect, useRef } from 'react'

export default function App() {
	const chorus = useChorus()
	const {
		state,
		loading,
		animating,
		animateIndex,
		activeVoiceId,
		setActiveVoiceId,
		mode,
		setMode,
		error,
		send,
		reset,
		skipAnimation,
		finishAnimation,
	} = chorus

	const transcriptRef = useRef<HTMLDivElement>(null)
	useEffect(() => {
		const el = transcriptRef.current
		if (el) el.scrollTop = el.scrollHeight
	}, [state, animating])

	const activeVoice = getVoice(activeVoiceId) ?? getVoice('rhetor')!
	const busy = loading || animating
	const hasUserTurn = state?.history.some((t) => t.role === 'user') ?? false
	// Show the opening chips until the user has answered, once Ритор finishes asking.
	const showOpeningChoices =
		!!state && state.phase === 'onboarding' && !hasUserTurn && !animating && !loading

	function confirmReset() {
		if (window.confirm('Начать заново? Разговор и собранный хор сотрутся.')) void reset()
	}

	return (
		<div className="app">
			<aside className="stage">
				<Portrait voice={activeVoice} size={200} />
				<div className="stage-name" style={{ color: activeVoice.color }}>
					{activeVoice.name}
				</div>
				<div className="stage-role">{activeVoice.function}</div>
				{state && <CastStrip cast={state.activeCast} activeVoiceId={activeVoiceId} />}
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
							onClick={() => setMode(mode === 'deep' ? 'default' : 'deep')}
						>
							{mode === 'deep' ? 'глубже ●' : 'глубже ○'}
						</button>
						<button title="Начать заново" onClick={confirmReset}>
							↺
						</button>
					</div>
				</header>

				<div className="transcript" ref={transcriptRef} onClick={skipAnimation}>
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
								animate={i === animateIndex && animating}
								onVoiceChange={setActiveVoiceId}
								onComplete={finishAnimation}
							/>
						)
					})}
					{showOpeningChoices && (
						<OpeningChoices options={OPENING_HOOK.options} disabled={busy} onPick={send} />
					)}
					{loading && <div className="thinking">…</div>}
					{error && <div className="error">{error}</div>}
				</div>

				<Composer disabled={busy || !state} onSend={send} />
			</main>
		</div>
	)
}
