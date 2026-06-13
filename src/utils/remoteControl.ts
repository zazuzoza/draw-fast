export type RemoteCommand = {
	prompt?: string
}

type Listener = (cmd: RemoteCommand) => void

const listeners = new Set<Listener>()

export function emitRemoteCommand(cmd: RemoteCommand) {
	for (const listener of listeners) {
		listener(cmd)
	}
}

export function subscribeToRemoteCommands(listener: Listener): () => void {
	listeners.add(listener)
	return () => listeners.delete(listener)
}
