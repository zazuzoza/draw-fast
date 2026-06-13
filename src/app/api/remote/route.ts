import { emitRemoteCommand } from '@/utils/remoteControl'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
	const body = await req.json()
	emitRemoteCommand(body)
	return NextResponse.json({ ok: true })
}
