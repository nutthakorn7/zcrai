import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // Core React
          if (id.includes('node_modules/react') || 
              id.includes('node_modules/react-dom') || 
              id.includes('node_modules/react-router')) {
            return 'vendor-react'
          }
          
          // HeroUI
          if (id.includes('@heroui')) {
            return 'vendor-heroui'
          }
          
          // Charts
          if (id.includes('recharts') || id.includes('d3-')) {
            return 'vendor-charts'
          }
          
          // Force Graph
          if (id.includes('force-graph') || id.includes('three')) {
            return 'vendor-graph'
          }
          
          // Markdown
          if (id.includes('react-markdown') || id.includes('remark') || id.includes('rehype')) {
            return 'vendor-markdown'
          }
          
          // Utilities
          if (id.includes('axios') || id.includes('zustand') || id.includes('tanstack') || id.includes('date-fns')) {
            return 'vendor-utils'
          }
          
          // Other large node_modules
          if (id.includes('node_modules')) {
            // Group remaining modules
            if (id.includes('html2canvas')) return 'vendor-html2canvas'
            if (id.includes('framer-motion')) return 'vendor-motion'
          }
        }
      }
    },
    // Increase warning limit
    chunkSizeWarningLimit: 600,
  },
  server: {
    port: 5173,
    host: true,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      }
    }
  }
})
