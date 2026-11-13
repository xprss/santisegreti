import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const apiProxy = process.env.VITE_API_PROXY ?? 'http://localhost:8000'

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    proxy: {
      '/api': { target: apiProxy, changeOrigin: false },
    },
  },
  css: {
    preprocessorOptions: {
      scss: {
        // Bootstrap 5.3 usa ancora @import e funzioni globali di Sass.
        silenceDeprecations: ['import', 'global-builtin', 'color-functions', 'if-function'],
        quietDeps: true,
      },
    },
  },
  build: {
    chunkSizeWarningLimit: 1200,
  },
})
