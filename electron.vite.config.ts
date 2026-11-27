import { resolve } from 'node:path'
import { defineConfig } from 'electron-vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'

export default defineConfig({
  main: {},
  preload: {
    build: {
      // Sandboxed preloads can't load extra chunks: each one must be a single file.
      isolatedEntries: true,
      externalizeDeps: false,
      rollupOptions: {
        input: { paw: resolve('src/preload/paw.ts'), shell: resolve('src/preload/shell.ts') },
        // Sandboxed preloads must be CommonJS.
        output: { format: 'cjs', entryFileNames: '[name].cjs' }
      }
    }
  },
  renderer: {
    build: {
      rollupOptions: {
        input: {
          index: resolve('src/renderer/index.html'),
          paw: resolve('src/renderer/paw.html')
        }
      }
    },
    plugins: [svelte()]
  }
})
