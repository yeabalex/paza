import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
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
