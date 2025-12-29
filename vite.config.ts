import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { execSync } from 'child_process'

const basePath = process.env.NODE_ENV === 'production' ? '/Health-App/' : '/'

// Build-time information
const getBuildInfo = () => {
  const packageJson = require('./package.json')
  const appVersion = packageJson.version
  
  // Use GitHub Action env vars if available (production), otherwise use git commands (dev)
  const buildSha = process.env.VITE_BUILD_SHA
    ? (process.env.VITE_BUILD_SHA).substring(0, 7) // Short SHA (first 7 chars)
    : (() => {
        try {
          return execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim()
        } catch (error) {
          return 'dev'
        }
      })()
  
  const buildRun = process.env.VITE_BUILD_RUN || 'dev'
  const buildTimestamp = process.env.VITE_BUILD_TIME || new Date().toISOString()
  
  return {
    commitSha: buildSha,
    buildRun,
    buildTimestamp,
    appVersion,
    isProduction: process.env.NODE_ENV === 'production'
  }
}

const buildInfo = getBuildInfo()

// https://vitejs.dev/config/
export default defineConfig({
  base: basePath,
  define: {
    __BUILD_INFO__: JSON.stringify(buildInfo)
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      strategies: 'generateSW',
      injectRegister: null,
      devOptions: {
        enabled: true // Enable PWA in development for testing
      },
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
      manifest: {
        name: 'CodePuppy Trainer',
        short_name: 'CP Trainer',
        description: 'Offline-first AI-style personal trainer and fitness tracker',
        theme_color: '#3b82f6',
        background_color: '#ffffff',
        display: 'standalone',
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
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
              }
            }
          }
        ]
      }
    })
  ],
  resolve: {
    alias: {
      '@': '/src',
      '@/components': '/src/components',
      '@/pages': '/src/pages',
      '@/lib': '/src/lib',
      '@/db': '/src/db',
      '@/types': '/src/types',
      '@/hooks': '/src/hooks',
      '@/utils': '/src/utils',
      '@/assets': '/src/assets'
    }
  },
  build: {
    sourcemap: true, // Enable sourcemaps for diagnosis
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          router: ['react-router-dom'],
          charts: ['recharts'],
          forms: ['react-hook-form', '@hookform/resolvers', 'zod'],
          storage: ['dexie']
        }
      }
    }
  }
})