// All chat state and flow in one hook; App stays a view.

import { useEffect, useRef, useState } from 'react'
import { OPENING_HOOK } from '../../shared/onboarding'
import type { Mode, UserState } from '../../shared/types'
import { emptyUserState } from '../../shared/types'
import { respond } from '../lib/api'
import { clearState, loadState, saveState } from '../lib/db'

export function useChorus() {
	const [state, setState] = useState<UserState | null>(null)
	const [loading, setLoading] = useState(false)
	const [animating, setAnimating] = useState(false)
	const [animateIndex, setAnimateIndex] = useState<number | null>(null)
	const [activeVoiceId, setActiveVoiceId] = useState<string>('rhetor')
	const [mode, setMode] = useState<Mode>('default')
	const [error, setError] = useState<string | null>(null)
	const booted = useRef(false)

	// Boot: restore a saved conversation or seed the fixed opening.
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
				await seedOpening()
			}
		})()
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [])

	// The opener is fixed and rendered locally — no model call. Ритор asks the
	// «заточенная палка» question; the chips answer it.
	async function seedOpening() {
		const seeded: UserState = {
			...emptyUserState(),
			history: [
				{
					role: 'voices',
					scene: [{ voice: 'rhetor', line: OPENING_HOOK.question, intensity: 'normal' }],
				},
			],
		}
		setActiveVoiceId('rhetor')
		setState(seeded)
		setAnimateIndex(0)
		setAnimating(true)
		await saveState(seeded)
	}

	async function send(text: string) {
		if (!state || loading) return
		// optimistic: show the user's line immediately
		setState({ ...state, history: [...state.history, { role: 'user', content: text }] })
		setLoading(true)
		setError(null)
		try {
			const res = await respond(state, text, mode)
			await saveState(res.userState)
			setState(res.userState)
			setAnimateIndex(res.userState.history.length - 1)
			setAnimating(true)
		} catch (e) {
			console.error(e)
			setError('Голоса не отвечают — что-то с сетью или сервером. Попробуй ещё раз.')
			setState(state) // roll back the optimistic turn
		} finally {
			setLoading(false)
		}
	}

	async function reset() {
		await clearState()
		setAnimateIndex(null)
		setError(null)
		await seedOpening()
	}

	/** Cut the typewriter short: reveal the whole current scene at once. */
	function skipAnimation() {
		if (!animating) return
		setAnimateIndex(null)
		setAnimating(false)
	}

	return {
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
		finishAnimation: () => setAnimating(false),
	}
}
