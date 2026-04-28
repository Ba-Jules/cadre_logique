import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'

// Sans type="module", les scripts inline s'exécutent immédiatement dans <head>
// avant que <div id="root"> soit créé → React error #299.
// Solution : retirer type="module" ET déplacer les scripts en fin de <body>.
const patchHtml = {
  name: 'patch-html',
  enforce: 'post',
  transformIndexHtml(html) {
    // 1. Retirer type="module" et crossorigin
    let result = html
      .replace(/\s*type="module"/g, '')
      .replace(/\s*crossorigin(?:="[^"]*")?/g, '')

    // 2. Extraire tous les <script> de <head> et les déplacer avant </body>
    //    afin que le DOM soit complet avant exécution du JS
    const scripts = []
    result = result.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, match => {
      scripts.push(match)
      return ''
    })
    if (scripts.length) {
      result = result.replace('</body>', scripts.join('\n') + '\n</body>')
    }

    return result
  },
}

export default defineConfig({
  plugins: [react(), viteSingleFile(), patchHtml],
  base: './',
  build: {
    outDir: 'dist',
    assetsInlineLimit: Infinity,
    cssCodeSplit: false,
    sourcemap: false,
    minify: 'terser',
    rollupOptions: {
      output: {
        format: 'iife',
        inlineDynamicImports: true,
      },
    },
  },
})
