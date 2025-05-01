import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'favicon.ico', 'robots.txt', 'apple-touch-icon.png'],
      manifest: {
        name: 'FaceBlur',
        short_name: 'FaceBlur',
        description: 'Privacy Made Simple',
        theme_color: '#ffffff',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: 'pwa-maskable-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'maskable'
          },
          {
            src: 'pwa-maskable-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          }
        ]
      },
      workbox: {
        maximumFileSizeToCacheInBytes: 15 * 1024 * 1024, // 15MB
        // globIgnores: ['/dist/assets/index-Cs5U_0s0.js', "assets/opencv-CRqMgVXC.js"],
      }
    })
  ],
  esbuild: {
    supported: {
      'top-level-await': true,
    }
  },
  build:{
    rollupOptions: {
      output: {
        manualChunks: {
          opencv: ['@techstark/opencv-js'],
        }
      }
    }
  },
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
});
