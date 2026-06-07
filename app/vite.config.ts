import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // expose sur le réseau (tunnels / test mobile)
    // Proxy l'API → même origine que le front, pour que les liens publics (tunnel) marchent.
    proxy: {
      '/api': { target: 'http://localhost:4000', changeOrigin: true },
    },
    allowedHosts: ['.trycloudflare.com', '.loca.lt'],
  },
})
