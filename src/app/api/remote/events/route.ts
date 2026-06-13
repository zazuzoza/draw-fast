import { subscribeToRemoteCommands } from '@/utils/remoteControl'
import { NextRequest } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
	const stream = new ReadableStream({
		start(controller) {
			const encoder = new TextEncoder()

			const unsubscribe = subscribeToRemoteCommands((cmd) => {
				controller.enqueue(encoder.encode(`data: ${JSON.stringify(cmd)}\n\n`))
			})

			req.signal.addEventListener('abort', () => {
				unsubscribe()
				controller.close()
			})
		},
	})

	return new Response(stream, {
		headers: {
			'Content-Type': 'text/event-stream',
			'Cache-Control': 'no-cache',
			Connection: 'keep-alive',
		},
	})
}
