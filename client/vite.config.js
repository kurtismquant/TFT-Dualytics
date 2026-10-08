import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  define: {
    // Unique per build: main.jsx discards query caches persisted by an older
    // deploy, so data that ships with a deploy shows on the next visit.
    'import.meta.env.VITE_BUILD_ID': JSON.stringify(Date.now().toString(36)),
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
})
