import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
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
