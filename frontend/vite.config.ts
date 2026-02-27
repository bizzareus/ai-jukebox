import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png'],
      manifest: {
        name: 'Jukebox',
        short_name: 'Jukebox',
        description: 'Pay to play your favourite song at the bar',
        theme_color: '#E11D48',
        background_color: '#0F0F0F',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\/api\/.*/i,
            handler: 'NetworkFirst',
            options: { cacheName: 'api-cache' },
          },
          {
            urlPattern: /^https:\/\/i\.ytimg\.com\/.*/i,
            handler: 'CacheFirst',
            options: { cacheName: 'yt-thumbnails', expiration: { maxAgeSeconds: 86400 } },
          },
        ],
      },
    }),
  ],
  server: {
    allowedHosts: true, // allow ngrok and other tunnel hosts (e.g. *.ngrok-free.app)
    proxy: {
      '/api': { target: 'http://localhost:3001', changeOrigin: true },
      '/queue': { target: 'http://localhost:3001', ws: true },
    },
  },
});
