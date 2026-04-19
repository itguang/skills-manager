import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    vue()
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks (id) {
          if (!id.includes('node_modules')) return

          if (
            id.includes('md-editor-v3') ||
            id.includes('@codemirror') ||
            id.includes('/codemirror/')
          ) {
            return 'skill-package-editor'
          }

          if (
            id.includes('mermaid') ||
            id.includes('katex') ||
            id.includes('highlight.js') ||
            id.includes('medium-zoom') ||
            id.includes('markdown-it')
          ) {
            return 'skill-package-preview'
          }
        }
      }
    }
  },
  base: './'
})
