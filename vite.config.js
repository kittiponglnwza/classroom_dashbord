import { execSync } from 'node:child_process'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

const resolveGitCommit = () => {
  try {
    return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim()
  } catch {
    return ''
  }
}

const APP_VERSION = '1.2.2'
const APP_COMMIT = resolveGitCommit()
const APP_BUILD_TIME = new Date().toISOString()

// https://vite.dev/config/
export default defineConfig({
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              name: 'vendor',
              test: /node_modules[\\/]/,
              entriesAware: true,
              minSize: 20 * 1024,
              priority: 10,
            },
            {
              name: 'shared',
              entriesAware: true,
              minShareCount: 2,
              minSize: 20 * 1024,
              priority: 5,
            },
          ],
        },
      },
    },
  },
  define: {
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(APP_VERSION),
    'import.meta.env.VITE_APP_COMMIT': JSON.stringify(APP_COMMIT),
    'import.meta.env.VITE_APP_BUILD_TIME': JSON.stringify(APP_BUILD_TIME),
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: [
        'Logo.svg',
        'apple-touch-icon.png',
        'pwa-192x192.png',
        'pwa-512x512.png',
      ],
      manifest: {
        name: 'Classroom Hub | Student Workspace',
        short_name: 'Classroom Hub',
        description:
          'Manage Google Classroom coursework, class timetables, exam seating, GPA progress, and deadline alerts in one workspace.',
        theme_color: '#1E1E1E',
        background_color: '#1E1E1E',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        icons: [
          {
            src: '/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
          {
            src: '/Logo.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//, /^\/_vercel\//],
      },
      devOptions: {
        enabled: true,
      },
    }),
  ],
  server: {
    proxy: {
      '/api/exam-room': {
        target: 'http://www.scibase.kmutnb.ac.th',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/exam-room/, '/examroom/datatrain.php')
      }
    }
  }
})
