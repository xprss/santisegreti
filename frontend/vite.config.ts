import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

const apiProxy = process.env.VITE_API_PROXY ?? 'http://localhost:8000'

export default defineConfig({
  plugins: [
    react(),
    // PWA: manifest e service worker (Workbox) che precarica la build, così l'app
    // si installa sulla home e si apre subito anche con rete lenta. L'API non
    // passa mai dalla cache: i dati delle stanze arrivano sempre dal server.
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon-180x180.png'],
      manifest: {
        id: '/',
        name: 'Santi Segreti',
        short_name: 'Santi Segreti',
        description:
          'Il Secret Santa per amici, famiglie e colleghi: stanze su invito, estrazione con esclusioni, un albero da guardare insieme.',
        lang: 'it',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        theme_color: '#B3202A',
        background_color: '#7CB342',
        categories: ['lifestyle', 'social'],
        icons: [
          { src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          {
            src: '/maskable-icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        // La scena three.js sta in un chunk grosso: deve entrare nel precache.
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api(\/|$)/],
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  server: {
    host: true,
    port: 5173,
    proxy: {
      // ws: il WebSocket della lotteria passa dallo stesso proxy.
      '/api': { target: apiProxy, changeOrigin: false, ws: true },
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
