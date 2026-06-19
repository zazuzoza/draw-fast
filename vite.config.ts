import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// In dev, proxy /respond to the local wrangler dev server (port 8787).
export default defineConfig({
	plugins: [react()],
	server: {
		proxy: {
			'/respond': 'http://localhost:8787',
		},
	},
})
