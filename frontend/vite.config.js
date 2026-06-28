import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// The backend API runs on port 4000 by default (see backend/.env.example).
// In dev, requests to /api are proxied there so the browser avoids CORS issues.
const API_TARGET = process.env.VITE_API_PROXY_TARGET || 'http://localhost:5000'

export default defineConfig({
  plugins: [react()],
  server: {
    host: 'localhost',
    proxy: {
      '/api': {
        target: API_TARGET,
        changeOrigin: true,
      },
    },
  },
})
