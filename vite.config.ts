import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  // served from https://robinweitzel.github.io/home-organizer/
  base: '/home-organizer/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/icon.svg'],
      manifest: {
        name: 'Home Organizer',
        short_name: 'Organizer',
        description:
          'Draw your home, define storage areas in your furniture, and track where everything is — fully offline.',
        theme_color: '#ffffff',
        background_color: '#eef0f3',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
  test: {
    environment: 'node',
    passWithNoTests: true,
  },
} as Parameters<typeof defineConfig>[0]);
