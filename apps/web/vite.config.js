import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig(({ mode }) => {
  const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
  const env = loadEnv(mode, rootDir, '')
  const tunnelHost = env.VITE_TUNNEL_HOST?.trim()

  const allowedHosts = [
    'localhost',
    '127.0.0.1',
    '.ngrok-free.dev',
    '.ngrok.app',
    '.ngrok.io',
  ]

  if (tunnelHost) {
    allowedHosts.push(tunnelHost)
  }

  return {
    envDir: rootDir,
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        manifest: {
          name: 'SignBridge',
          short_name: 'SignBridge',
          description: 'Real-time sign language interpreter powered by AI',
          theme_color: '#7C3AED',
          background_color: '#0f0f0f',
          display: 'standalone',
          orientation: 'portrait',
          icons: [
            { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
            { src: '/icon-512.png', sizes: '512x512', type: 'image/png' }
          ]
        }
      })
    ],
    server: {
      host: '0.0.0.0',
      port: 5173,
      strictPort: true,
      allowedHosts,
      hmr: tunnelHost
        ? {
            protocol: 'wss',
            host: tunnelHost,
            clientPort: 443,
          }
        : undefined,
      // Proxy para que el cliente no exponga las API keys
      proxy: {
        '/api': {
          target: 'http://localhost:3001',
          changeOrigin: true
        }
      }
    }
  }
})
