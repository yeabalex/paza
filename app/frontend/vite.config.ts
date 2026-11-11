import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const monorepoRoot = fileURLToPath(new URL('../..', import.meta.url))
const isMonorepo = fs.existsSync(path.join(monorepoRoot, 'turbo.json'))

// https://vite.dev/config/
export default defineConfig({
  envDir: isMonorepo ? monorepoRoot : '.',
  plugins: [react()],
  server: {
    allowedHosts: true,
    host: true,
    proxy: {
      '/api': {
        target: 'https://3.223.18.171.nip.io',
        changeOrigin: true,
        secure: false,
      }
    }
  }
})
