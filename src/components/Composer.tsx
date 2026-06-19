// Message input. Enter sends; Shift+Enter newlines.

import { useState } from 'react'

export function Composer({
	disabled,
	onSend,
}: {
	disabled: boolean
	onSend: (text: string) => void
}) {
	const [text, setText] = useState('')

	const send = () => {
		const trimmed = text.trim()
		if (!trimmed || disabled) return
		onSend(trimmed)
		setText('')
	}

	return (
		<div className="composer">
			<textarea
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
