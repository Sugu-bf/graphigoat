#!/usr/bin/env node
/**
 * Share image (Open Graph, 1200×630) captured from the page itself, so links shared on LinkedIn, WhatsApp, Slack…
 * show the real hero. Run from the project folder while the site runs (npm run preview):
 *
 *   npm run og -- [--url http://localhost:4173] [--path /] [--out public/og.jpg] [--wait 2500] [--scroll 0]
 *
 * Then set the absolute URL in index.html: <meta property="og:image" content="https://domaine.fr/og.jpg" />
 */
import { createRequire } from 'node:module'
import { join, resolve } from 'node:path'

const require = createRequire(join(process.cwd(), 'package.json'))
const args = process.argv.slice(2)
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`)
  return i === -1 || args[i + 1] === undefined || args[i + 1].startsWith('--') ? fallback : args[i + 1]
}
const url = String(opt('url', 'http://localhost:4173')).replace(/\/$/, '') + String(opt('path', '/'))
const out = resolve(String(opt('out', 'public/og.jpg')))
const wait = Number(opt('wait', 2500))
const scroll = Number(opt('scroll', 0))

let chromium, sharp
try {
  ;({ chromium } = require('playwright-core'))
  sharp = require('sharp')
} catch {
  console.error('playwright-core and sharp are needed: npm i -D playwright-core sharp')
  process.exit(2)
}

const launch = async () => {
  for (const channel of ['chrome', 'chromium', 'msedge']) {
    try {
      return await chromium.launch({ channel, headless: true, args: ['--ignore-gpu-blocklist', '--enable-gpu-rasterization'] })
    } catch {}
  }
  return chromium.launch({ headless: true })
}

const browser = await launch()
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 })
await page.goto(url, { waitUntil: 'networkidle' })
await page.waitForFunction(() => document.documentElement.classList.contains('fx-ready'), null, { timeout: 15000 }).catch(() => {})
if (scroll) await page.evaluate((y) => window.scrollTo(0, y), scroll)
await page.waitForTimeout(wait)
const png = await page.screenshot({ type: 'png' })
await browser.close()
await sharp(png).jpeg({ quality: 86, mozjpeg: true }).toFile(out)
console.log(`✓ ${out} (1200×630)
<meta property="og:image" content="https://VOTRE-DOMAINE/og.jpg" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />`)
