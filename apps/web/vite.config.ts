/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icon-192.png', 'icon-512.png'],
      manifest: {
        name: 'Operação Rolê',
        short_name: 'Rolê',
        description: 'Transforme "vamos marcar algo?" em rolê confirmado.',
        lang: 'pt-BR',
        theme_color: '#0e1f3d',
        background_color: '#e8edf3',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Só o "casco" do app fica em cache. Dados financeiros e sessão nunca passam pelo service worker.
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//, /^\/share\//],
        globPatterns: ['**/*.{js,css,html,svg,png}'],
        runtimeCaching: [
          {
            urlPattern: ({ url }: { url: URL }) => /\.woff2?$/.test(url.pathname),
            handler: 'CacheFirst',
            options: {
              cacheName: 'fonts',
              expiration: { maxEntries: 12, maxAgeSeconds: 31536000 },
            },
          },
        ],
      },
    }),
  ],
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://127.0.0.1:3333', changeOrigin: false },
      // Página de compartilhamento com Open Graph (prévia do link no WhatsApp).
      '/share': { target: 'http://127.0.0.1:3333', changeOrigin: false },
    },
  },
  build: { sourcemap: true },
  test: { environment: 'node' },
});
