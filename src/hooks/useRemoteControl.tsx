'use client'

import { LiveImageShape } from '@/components/LiveImageShapeUtil'
import { Editor } from '@tldraw/tldraw'
import { useEffect } from 'react'

export function useRemoteControl(editor: Editor) {
	useEffect(() => {
		const eventSource = new EventSource('/api/remote/events')

		eventSource.onmessage = (event) => {
			try {
				const cmd = JSON.parse(event.data)
				if (typeof cmd.prompt === 'string') {
					const liveShape = editor
						.getCurrentPageShapes()
						.find((s): s is LiveImageShape => s.type === 'live-image')
					if (liveShape) {
						editor.updateShape<LiveImageShape>({
							id: liveShape.id,
							type: 'live-image',
							props: { name: cmd.prompt },
						})
					}
				}
			} catch {
				// ignore malformed messages
			}
		}

		return () => eventSource.close()
	}, [editor])
}
