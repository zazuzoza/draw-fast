// Message input. Enter sends; Shift+Enter newlines. Refocuses when re-enabled.

import { useEffect, useRef, useState } from 'react'

export function Composer({
	disabled,
	onSend,
}: {
	disabled: boolean
	onSend: (text: string) => void
}) {
	const [text, setText] = useState('')
	const ref = useRef<HTMLTextAreaElement>(null)

	useEffect(() => {
		if (!disabled) ref.current?.focus()
	}, [disabled])

	const send = () => {
		const trimmed = text.trim()
		if (!trimmed || disabled) return
		onSend(trimmed)
		setText('')
	}

	return (
		<div className="composer">
			<textarea
				ref={ref}
				value={text}
				disabled={disabled}
				rows={1}
				placeholder={disabled ? 'голоса думают…' : 'скажи что-нибудь…'}
				onChange={(e) => setText(e.target.value)}
				onKeyDown={(e) => {
					if (e.key === 'Enter' && !e.shiftKey) {
						e.preventDefault()
						send()
					}
				}}
			/>
			<button onClick={send} disabled={disabled || !text.trim()}>
				→
			</button>
		</div>
	)
}
