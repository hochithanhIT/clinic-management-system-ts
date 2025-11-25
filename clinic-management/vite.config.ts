import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import vueDevTools from 'vite-plugin-vue-devtools'
import VueRouter from 'unplugin-vue-router/vite'
import AutoImport from 'unplugin-auto-import/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    VueRouter(),
    AutoImport({
      imports: [
        'vue',
        'vue-router',
        'pinia'
      ],
      dirs: [
        './src/stores'
      ],
      dts: 'src/auto-imports.d.ts',
      eslintrc: {
        enabled: true, // Bật cái này lên
        filepath: './.eslintrc-auto-import.json', // File json sẽ được sinh ra
        globalsPropValue: true,
      },
    }),
    vue(),
    tailwindcss(),
    vueDevTools(),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    },
  },
})
