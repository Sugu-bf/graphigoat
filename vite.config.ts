import { existsSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

const root = fileURLToPath(new URL('.', import.meta.url))

// Every .html file at the root and in pages/ is a page of the site (one entry per file).
const html = (dir: string) => (existsSync(root + dir) ? readdirSync(root + dir).filter((f) => f.endsWith('.html')) : [])
const input = Object.fromEntries([
  ...html('').map((f) => [f.replace(/\.html$/, ''), root + f]),
  ...html('pages').map((f) => ['pages/' + f.replace(/\.html$/, ''), root + 'pages/' + f]),
  ['fr/index', root + 'fr/index.html'],
])

export default defineConfig({
  // Relative asset paths: the build works from any folder or sub-path (previews, client servers).
  base: './',
  build: {
    target: 'es2022',
    assetsInlineLimit: 2048,
    // three.js core is one ~580 kB chunk (≈150 kB gzip), loaded only by pages that use a WebGL effect.
    chunkSizeWarningLimit: 700,
    rolldownOptions: { input },
  },
  server: { host: true },
})
