#!/usr/bin/env node
// Construit index.html : un seul fichier autonome (React, Leaflet, logo et app embarqués).
// Aucun serveur requis : double-cliquez sur index.html ou publiez-le tel quel.
// Usage : node build.mjs   (Babel n'est utilisé qu'ici, pour compiler le JSX une fois)
import { readFileSync, writeFileSync, statSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'

const root = dirname(fileURLToPath(import.meta.url))
const read = (f) => readFileSync(join(root, f), 'utf8')
const dataUrl = (f, mime) => `data:${mime};base64,` + readFileSync(join(root, f)).toString('base64')
const inline = (code) => code.replace(/<\/script/gi, '<\\/script')

// Babel standalone : vendor/babel.min.js (outil de build uniquement, non embarqué)
const babelPath = join(root, 'vendor', 'babel.min.js')
if (!existsSync(babelPath)) throw new Error('vendor/babel.min.js manquant (https://unpkg.com/@babel/standalone@7.24.7/babel.min.js)')
const ctx = { window: {}, self: {}, console }
ctx.globalThis = ctx
vm.createContext(ctx)
vm.runInContext(readFileSync(babelPath, 'utf8'), ctx)
const Babel = ctx.Babel || ctx.window.Babel || ctx.self.Babel
const app = Babel.transform(read('src/app.jsx'), { presets: ['react'] }).code

const icons = {
  iconUrl: dataUrl('vendor/marker-icon.png', 'image/png'),
  iconRetinaUrl: dataUrl('vendor/marker-icon-2x.png', 'image/png'),
  shadowUrl: dataUrl('vendor/marker-shadow.png', 'image/png'),
}

const html = `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<title>Fanico Moderne – Reçus</title>
<style>
${read('vendor/leaflet.css')}
${read('src/styles.css')}
</style>
</head>
<body>
<div id="root"></div>
<script>
window.__LOGO__ = ${JSON.stringify(dataUrl('assets/logo.png', 'image/png'))};
window.__LEAFLET_ICONS__ = ${JSON.stringify(icons)};
(function(){var l=document.createElement('link');l.rel='icon';l.href=window.__LOGO__;document.head.appendChild(l)})();
</script>
<script>
${inline(read('vendor/react.production.min.js'))}
</script>
<script>
${inline(read('vendor/react-dom.production.min.js'))}
</script>
<script>
${inline(read('vendor/leaflet.js'))}
L.Icon.Default.imagePath = '';
</script>
<script>
${inline(app)}
</script>
</body>
</html>
`

const target = join(root, 'index.html')
writeFileSync(target, html, 'utf8')
console.log(`index.html écrit (${(statSync(target).size / 1024).toFixed(1)} Ko) — autonome, sans serveur.`)
