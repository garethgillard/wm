// Turns dist-demo/ into one self-contained HTML file (JS, CSS and fonts inlined)
// so the demo can be published as a single page.
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const dir = 'dist-demo'
const html = readFileSync(join(dir, 'index.html'), 'utf8')
const read = path => readFileSync(join(dir, path.replace(/^\.\//, '')), 'utf8')

const js = html.match(/<script type="module"[^>]*src="([^"]+)"[^>]*><\/script>/)
const css = html.match(/<link rel="stylesheet"[^>]*href="([^"]+)"[^>]*>/)
if (!js || !css) throw new Error('Could not find the built script or stylesheet in dist-demo/index.html')

const script = read(js[1]).replace(/<\/script/gi, '<\\/script')
const style = read(css[1]).replace(/<\/style/gi, '<\\/style')

const page = [
  '<title>Party HQ Demo</title>',
  '<meta name="claude:viewport-fit-sides" content="cover">',
  `<style>${style}</style>`,
  '<div id="root"></div>',
  `<script type="module">${script}</script>`,
].join('\n')

writeFileSync(join(dir, 'party-hq-demo.html'), page)
console.log(`Wrote ${dir}/party-hq-demo.html (${Math.round(page.length / 1024)} KB)`)
