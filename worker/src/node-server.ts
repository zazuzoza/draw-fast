// Minimal Node host for the Worker — reuses the same `fetch` handler so the backend
// can be self-hosted on a plain server (VPS) instead of Cloudflare.
// Run with: ANTHROPIC_API_KEY=... npm start   (uses tsx; needs Node >= 18).

import { createServer, type IncomingMessage } from 'node:http'
import worker from './index'

const port = Number(process.env.PORT ?? 8787)
const env = { ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY ?? '' }

function readBody(req: IncomingMessage): Promise<Buffer> {
	return new Promise((resolve, reject) => {
		const chunks: Buffer[] = []
		req.on('data', (c: Buffer) => chunks.push(c))
		req.on('end', () => resolve(Buffer.concat(chunks)))
		req.on('error', reject)
	})
}

const server = createServer(async (req, res) => {
	try {
		const url = `http://${req.headers.host ?? 'localhost'}${req.url ?? '/'}`
		const method = req.method ?? 'GET'
		const headers = new Headers()
		for (const [k, v] of Object.entries(req.headers)) {
			if (Array.isArray(v)) v.forEach((x) => headers.append(k, x))
			else if (v != null) headers.set(k, v)
		}
		const hasBody = method !== 'GET' && method !== 'HEAD'
		const body = hasBody ? await readBody(req) : undefined
		const request = new Request(url, { method, headers, body })
		const response = await worker.fetch(request, env)
		res.writeHead(response.status, Object.fromEntries(response.headers))
		res.end(Buffer.from(await response.arrayBuffer()))
	} catch (e) {
		res.writeHead(500, { 'content-type': 'application/json' })
		res.end(JSON.stringify({ error: String(e) }))
	}
})

server.listen(port, () => console.log(`khor worker (node) on :${port}`))
