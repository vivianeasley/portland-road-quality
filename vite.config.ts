import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  base: '/portland-road-quality/',
  plugins: [
    react(),
    {
      name: 'geojson',
      transform(src, id) {
        if (id.endsWith('.geojson'))
          return { code: `export default ${src}` }
      }
    }
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('partOne')) return 'partOne';
          if (id.includes('partTwo')) return 'partTwo';
        }
      }
    }
  }
})
