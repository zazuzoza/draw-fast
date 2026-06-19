// IndexedDB persistence for the single UserState (ТЗ §3, MVP — client only).

import type { UserState } from '../../shared/types'

const DB_NAME = 'chorus'
const STORE = 'state'
const KEY = 'userState'

function open(): Promise<IDBDatabase> {
	return new Promise((resolve, reject) => {
		const req = indexedDB.open(DB_NAME, 1)
		req.onupgradeneeded = () => {
			req.result.createObjectStore(STORE)
		}
		req.onsuccess = () => resolve(req.result)
		req.onerror = () => reject(req.error)
	})
}

export async function loadState(): Promise<UserState | null> {
	try {
		const db = await open()
		return await new Promise((resolve, reject) => {
			const tx = db.transaction(STORE, 'readonly')
			const req = tx.objectStore(STORE).get(KEY)
			req.onsuccess = () => resolve((req.result as UserState) ?? null)
			req.onerror = () => reject(req.error)
		})
	} catch {
		return null
	}
}

export async function saveState(state: UserState): Promise<void> {
	const db = await open()
	await new Promise<void>((resolve, reject) => {
		const tx = db.transaction(STORE, 'readwrite')
		tx.objectStore(STORE).put(state, KEY)
		tx.oncomplete = () => resolve()
		tx.onerror = () => reject(tx.error)
	})
}

export async function clearState(): Promise<void> {
	const db = await open()
	await new Promise<void>((resolve, reject) => {
		const tx = db.transaction(STORE, 'readwrite')
		tx.objectStore(STORE).delete(KEY)
		tx.oncomplete = () => resolve()
		tx.onerror = () => reject(tx.error)
	})
}
