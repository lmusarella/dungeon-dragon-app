import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/icon.svg'],
      manifest: {
        name: 'Dungeon Dragon',
        short_name: 'DungeonDragon',
        description: 'Tablet-first D&D character manager',
        theme_color: '#6f4e37',
        background_color: '#f6f1e7',
        display: 'standalone',
        start_url: '/#/',
        icons: [
          {
            src: '/icons/icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any'
          }
        ]
      }
    })
  ]
});
