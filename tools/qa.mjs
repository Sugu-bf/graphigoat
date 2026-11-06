#!/usr/bin/env node
/**
 * Landing Forge QA — checks a running site the way a demanding visitor would, and writes a report.
 *
 *   node <skill>/scripts/qa.mjs --url http://localhost:5173 [--pages /,/about.html] [--widths 390,1440]
 *                                [--motion full|reduce|both] [--out qa] [--steps 6] [--no-shots] [--fps]
 *                                [--storage qa/session.json]   (pages behind a login: see qa-login.mjs)
 *
 * Run it from the project folder (it uses the project's playwright-core, axe-core and sharp).
 * For every page × width × motion setting it:
 *   - records console errors, page errors, failed or 4xx/5xx requests;
 *   - scrolls through the page like a visitor (so scroll animations and lazy effects run) and screenshots each step;
 *   - finds horizontal overflow and the elements causing it;
 *   - finds content that stays invisible (a reveal that never played, text hidden by mistake);
 *   - runs axe-core (WCAG 2 A/AA) and lists violations;
 *   - on French pages, flags typography slips (spaces before ; : ! ?, straight quotes and apostrophes);
 *   - measures LCP, CLS, transferred weight by type, and the frame rate at the top and middle of the page (--fps).
 * Output: <out>/report.md (read this), <out>/report.json, <out>/shots/*.jpg and one contact sheet per run.
 * Exit code 1 when blocking issues are found (errors, overflow, invisible content, serious a11y violations).
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join, resolve } from 'node:path'

const require = createRequire(join(process.cwd(), 'package.json'))
const need = (name) => {
  try {
    return require(name)
  } catch {
    console.error(`Missing dependency "${name}" in this project. Install it: npm i -D playwright-core axe-core sharp`)
    process.exit(2)
  }
}

// ---------------------------------------------------------------- arguments
const args = process.argv.slice(2)
const arg = (name, fallback) => {
  const i = args.indexOf(`--${name}`)
  if (i === -1) return fallback
  const v = args[i + 1]
  return v === undefined || v.startsWith('--') ? true : v
}
const base = String(arg('url', 'http://localhost:5173')).replace(/\/$/, '')
const pages = String(arg('pages', '/')).split(',').map((p) => (p.startsWith('/') ? p : `/${p}`))
const widths = String(arg('widths', '390,768,1440')).split(',').map(Number).filter(Boolean)
const motionArg = String(arg('motion', 'full'))
const motions = motionArg === 'both' ? ['full', 'reduce'] : [motionArg]
const outDir = resolve(String(arg('out', 'qa')))
const steps = Number(arg('steps', 6))
const shots = !args.includes('--no-shots')
const measureFps = args.includes('--fps')
const storage = arg('storage', '')
if (storage && !existsSync(String(storage))) {
  console.error(`No session file at ${storage}: create it with qa-login.mjs`)
  process.exit(2)
}

const { chromium } = need('playwright-core')
const sharp = need('sharp')
const axePath = require.resolve('axe-core/axe.min.js')
const axeSource = readFileSync(axePath, 'utf8')

mkdirSync(join(outDir, 'shots'), { recursive: true })

const launch = async () => {
  for (const channel of ['chrome', 'chromium', 'msedge']) {
    try {
      return await chromium.launch({ channel, headless: true, args: ['--ignore-gpu-blocklist', '--enable-gpu-rasterization'] })
    } catch {}
  }
  try {
    return await chromium.launch({ headless: true })
  } catch {
    console.error('No browser found. Install Google Chrome, or run: npx playwright install chromium')
    process.exit(2)
  }
}

const slug = (s) => s.replace(/^\//, '').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'home'

// ---------------------------------------------------------------- in-page probes
const probeOverflow = () => {
  const vw = document.documentElement.clientWidth
  const clipped = (el) => {
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      const s = getComputedStyle(p)
      if (/(hidden|clip|auto|scroll)/.test(s.overflowX) && p.getBoundingClientRect().right <= vw + 1) return true
    }
    return false
  }
  const culprits = []
  for (const el of document.querySelectorAll('body *')) {
    const r = el.getBoundingClientRect()
    if (!r.width || r.right <= vw + 1) continue
    if (clipped(el)) continue
    let fixed = false
    for (let p = el; p && p !== document.body; p = p.parentElement) if (getComputedStyle(p).position === 'fixed') fixed = true
    if (fixed) continue
    culprits.push({ el: `${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}.${String(el.className).trim().split(/\s+/).slice(0, 3).join('.')}`, right: Math.round(r.right) })
  }
  culprits.sort((a, b) => b.right - a.right)
  return { scrollWidth: document.documentElement.scrollWidth, viewport: vw, culprits: culprits.slice(0, 6) }
}

const probeInvisible = () => {
  const out = []
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
  const seen = new Set()
  while (walker.nextNode()) {
    const text = walker.currentNode.textContent.trim()
    if (text.length < 2) continue
    const el = walker.currentNode.parentElement
    // Crossfading layers (pin-steps visuals) are hidden on purpose while another one is shown.
    if (!el || seen.has(el) || el.closest('[aria-hidden="true"], [hidden], script, style, noscript, template, .sr-only, [inert], [data-step-visual]')) continue
    seen.add(el)
    let node = el
    let hidden = null
    while (node && node !== document.documentElement) {
      const s = getComputedStyle(node)
      if (s.display === 'none') {
        hidden = null
        break
      }
      if (s.visibility === 'hidden' || Number(s.opacity) < 0.05) {
        hidden = node
        break
      }
      node = node.parentElement
    }
    if (hidden) out.push({ text: text.slice(0, 60), el: `${hidden.tagName.toLowerCase()}.${String(hidden.className).trim().split(/\s+/).slice(0, 2).join('.')}` })
  }
  return out.slice(0, 12)
}

// French typography: narrow no-break space before ; ! ? and inside « », no-break space before :, curly apostrophes.
const probeFrench = () => {
  if (!(document.documentElement.lang || '').toLowerCase().startsWith('fr')) return null
  const rules = [
    [/([^\s!?])([;!?])(?=[\s»)\]]|$)/g, (m) => `espace fine insécable manquante avant « ${m[2]} » (&#8239;)`],
    [/ ([;!?])/g, (m) => `espace ordinaire avant « ${m[1]} » : la remplacer par une fine insécable (&#8239;)`],
    [/([^\s\d:])(:)(?=\s)/g, () => 'espace insécable manquante avant « : » (&nbsp;)'],
    [/ :/g, () => 'espace ordinaire avant « : » : la remplacer par une insécable (&nbsp;)'],
    [/«(?!\s)|(?<!\s)»/g, () => 'espace fine insécable manquante à l’intérieur des guillemets « »'],
    [/"/g, () => 'guillemets droits : utiliser « … »'],
    [/\p{L}'\p{L}/gu, () => 'apostrophe droite : utiliser ’'],
  ]
  const skip = 'script, style, code, pre, kbd, samp, textarea, [aria-hidden="true"], [translate="no"]'
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
  const found = []
  let count = 0
  while (walker.nextNode()) {
    const node = walker.currentNode
    const text = node.textContent ?? ''
    if (!text.trim() || text.includes('://') || node.parentElement?.closest(skip)) continue
    for (const [re, label] of rules) {
      for (const m of text.matchAll(re)) {
        count++
        if (found.length < 12) {
          const i = m.index ?? 0
          found.push({ rule: label(m), sample: text.slice(Math.max(0, i - 18), i + 18).replace(/\s+/g, ' ').trim() })
        }
      }
    }
  }
  return { count, found }
}

const probeMetrics = () =>
  new Promise((resolveMetrics) => {
    let lcp = 0
    let cls = 0
    try {
      new PerformanceObserver((l) => l.getEntries().forEach((e) => (lcp = Math.max(lcp, e.startTime)))).observe({ type: 'largest-contentful-paint', buffered: true })
      new PerformanceObserver((l) => l.getEntries().forEach((e) => !e.hadRecentInput && (cls += e.value))).observe({ type: 'layout-shift', buffered: true })
    } catch {}
    setTimeout(() => {
      const bytes = { script: 0, css: 0, img: 0, font: 0, other: 0 }
      for (const r of performance.getEntriesByType('resource')) {
        const size = r.transferSize || r.encodedBodySize || 0
        const t = r.initiatorType === 'script' ? 'script' : r.initiatorType === 'img' ? 'img' : /\.css(\?|$)/.test(r.name) || r.initiatorType === 'link' ? (/\.(woff2?|ttf|otf)(\?|$)/.test(r.name) ? 'font' : 'css') : /\.(woff2?|ttf|otf)(\?|$)/.test(r.name) ? 'font' : /\.(png|jpe?g|webp|avif|gif|svg)(\?|$)/.test(r.name) ? 'img' : 'other'
        bytes[t] += size
      }
      const nav = performance.getEntriesByType('navigation')[0]
      resolveMetrics({ lcp: Math.round(lcp), cls: Number(cls.toFixed(3)), bytes, domContentLoaded: Math.round(nav?.domContentLoadedEventEnd ?? 0), load: Math.round(nav?.loadEventEnd ?? 0) })
    }, 300)
  })

const probeFps = (ms) =>
  new Promise((r) => {
    let frames = 0
    const start = performance.now()
    const tick = () => {
      frames++
      if (performance.now() - start < ms) requestAnimationFrame(tick)
      else r(Math.round((frames * 1000) / (performance.now() - start)))
    }
    requestAnimationFrame(tick)
  })

// ---------------------------------------------------------------- run
const browser = await launch()
const runs = []

for (const page of pages) {
  for (const width of widths) {
    for (const motion of motions) {
      const mobile = width < 600
      const ctx = await browser.newContext({
        viewport: { width, height: mobile ? 844 : 900 },
        deviceScaleFactor: 1,
        isMobile: mobile,
        hasTouch: mobile,
        reducedMotion: motion === 'reduce' ? 'reduce' : 'no-preference',
        ...(storage ? { storageState: String(storage) } : {}),
      })
      const tab = await ctx.newPage()
      const run = { page, width, motion, errors: [], warnings: [], requests: [], shots: [] }
      tab.on('console', (m) => {
        const where = m.location()?.url ? ` (${m.location().url.replace(base, '')})` : ''
        const text = m.text().slice(0, 300) + where
        if (m.type() === 'error') run.errors.push(text)
        else if (m.type() === 'warning' && !/preload|DevTools|Download the/.test(text)) run.warnings.push(text)
      })
      tab.on('pageerror', (e) => run.errors.push(`pageerror: ${e.message.slice(0, 300)}`))
      tab.on('requestfailed', (r) => {
        const f = r.failure()?.errorText ?? ''
        if (!/ERR_ABORTED/.test(f)) run.requests.push(`failed ${r.url()} ${f}`)
      })
      tab.on('response', (r) => {
        if (r.status() >= 400) run.requests.push(`${r.status()} ${r.url()}`)
      })

      const url = base + page
      try {
        await tab.goto(url, { waitUntil: 'load', timeout: 45000 })
        await tab.waitForFunction(() => document.documentElement.classList.contains('fx-ready') || !document.documentElement.classList.contains('fx'), null, { timeout: 12000 }).catch(() => run.warnings.push('the page never reached fx-ready (boot did not finish within 12 s)'))
        await tab.waitForTimeout(700)
        if (measureFps) run.fpsTop = await tab.evaluate(probeFps, 2000)

        const height = await tab.evaluate(() => document.documentElement.scrollHeight - window.innerHeight)
        const n = Math.max(1, steps)
        for (let i = 0; i <= n; i++) {
          const y = Math.round((height * i) / n)
          await tab.evaluate((top) => window.scrollTo(0, top), y)
          await tab.waitForTimeout(motion === 'reduce' ? 250 : 650)
          if (measureFps && i === Math.round(n / 2)) run.fpsMiddle = await tab.evaluate(probeFps, 2000)
          if (shots) {
            const file = join(outDir, 'shots', `${slug(page)}-${width}-${motion}-${i}.jpg`)
            await tab.screenshot({ path: file, type: 'jpeg', quality: 70 })
            run.shots.push(file)
          }
        }
        // back to the top: what remains invisible after a full visit is a real problem
        await tab.evaluate(() => window.scrollTo(0, 0))
        await tab.waitForTimeout(400)
        run.overflow = await tab.evaluate(probeOverflow)
        await tab.evaluate((top) => window.scrollTo(0, top), Math.round(height / 2))
        run.invisible = await tab.evaluate(probeInvisible)
        if (width === widths[0] && motion === motions[0]) run.french = await tab.evaluate(probeFrench)
        run.metrics = await tab.evaluate(probeMetrics)
        await tab.addScriptTag({ content: axeSource })
        const axe = await tab.evaluate(async () => {
          const res = await window.axe.run(document, { runOnly: ['wcag2a', 'wcag2aa'], resultTypes: ['violations'] })
          // Contrast of visual duplicates hidden from assistive tech (split text, marquee copies) is a design state, not missing content.
          const decorative = (target) => {
            const el = document.querySelector(target.join(' '))
            return !!el?.closest('[aria-hidden="true"]')
          }
          return res.violations
            .map((v) => {
              const nodes = v.id === 'color-contrast' ? v.nodes.filter((n) => !decorative(n.target)) : v.nodes
              return { id: v.id, impact: v.impact, help: v.help, nodes: nodes.length, sample: nodes[0]?.target?.join(' ') }
            })
            .filter((v) => v.nodes > 0)
        })
        run.a11y = axe
        run.devServer = await tab.evaluate(() => !!document.querySelector('script[src*="/@vite/client"]'))
      } catch (err) {
        run.errors.push(`QA could not complete: ${err.message.split('\n')[0]}`)
      }
      await ctx.close()

      // contact sheet of the scroll-through
      if (run.shots.length) {
        const thumbs = await Promise.all(run.shots.map((f) => sharp(f).resize({ width: mobile ? 260 : 480 }).toBuffer()))
        const meta = await sharp(thumbs[0]).metadata()
        const cols = Math.min(thumbs.length, mobile ? 7 : 4)
        const rows = Math.ceil(thumbs.length / cols)
        const gap = 8
        const sheet = sharp({ create: { width: cols * (meta.width + gap) + gap, height: rows * (meta.height + gap) + gap, channels: 3, background: '#111' } })
        const composite = thumbs.map((input, k) => ({ input, left: gap + (k % cols) * (meta.width + gap), top: gap + Math.floor(k / cols) * (meta.height + gap) }))
        run.sheet = join(outDir, `${slug(page)}-${width}-${motion}.jpg`)
        await sheet.composite(composite).jpeg({ quality: 72 }).toFile(run.sheet)
      }
      runs.push(run)
      const overflowing = run.overflow && run.overflow.scrollWidth > run.overflow.viewport + 1
      const blocking = run.errors.length + run.requests.length + (overflowing ? 1 : 0) + (run.invisible?.length ?? 0)
      console.log(`${blocking ? '✗' : '✓'} ${page} @${width} (${motion})${blocking ? ` — ${blocking} issue(s)` : ''}`)
    }
  }
}
await browser.close()

// ---------------------------------------------------------------- report
const kb = (b) => `${Math.round(b / 1024)} ko`
const lines = ['# QA report', '', `${new Date().toISOString()} · ${base}`, '']
if (runs.some((r) => r.devServer)) lines.push('> Measured on a development server: weights, LCP and CLS are not representative (styles are injected after the first paint). For the final check, run `npm run build && npm run preview` and point QA at the preview.', '')
let blockingTotal = 0
for (const r of runs) {
  const a11ySerious = (r.a11y ?? []).filter((v) => v.impact === 'serious' || v.impact === 'critical')
  const overflow = r.overflow && r.overflow.scrollWidth > r.overflow.viewport + 1
  const blocking = r.errors.length + r.requests.length + (overflow ? 1 : 0) + (r.invisible?.length ?? 0) + a11ySerious.length
  blockingTotal += blocking
  lines.push(`## ${r.page} · ${r.width}px · motion ${r.motion} — ${blocking ? `${blocking} blocking` : 'clean'}`, '')
  if (r.metrics) {
    const b = r.metrics.bytes
    lines.push(`LCP ${r.metrics.lcp} ms · CLS ${r.metrics.cls} · JS ${kb(b.script)} · CSS ${kb(b.css)} · images ${kb(b.img)} · fonts ${kb(b.font)}${r.fpsTop ? ` · fps top ${r.fpsTop} / middle ${r.fpsMiddle ?? '—'}` : ''}`, '')
  }
  if (r.errors.length) lines.push('**Errors**', ...r.errors.map((e) => `- ${e}`), '')
  if (r.requests.length) lines.push('**Requests**', ...r.requests.map((e) => `- ${e}`), '')
  if (overflow) lines.push(`**Horizontal overflow**: page ${r.overflow.scrollWidth}px for ${r.overflow.viewport}px`, ...r.overflow.culprits.map((c) => `- ${c.el} reaches ${c.right}px`), '')
  else if (r.overflow?.culprits.length) lines.push('**Cut at the right edge** (the page does not scroll sideways, but these may be clipped; check the screenshots)', ...r.overflow.culprits.map((c) => `- ${c.el} reaches ${c.right}px`), '')
  if (r.invisible?.length) lines.push('**Content still invisible after a full scroll**', ...r.invisible.map((c) => `- "${c.text}" (hidden by ${c.el})`), '')
  if (r.a11y?.length) lines.push('**Accessibility (axe)**', ...r.a11y.map((v) => `- [${v.impact}] ${v.id}: ${v.help} (${v.nodes}×, e.g. ${v.sample})`), '')
  if (r.french?.count) lines.push(`**Typographie française** (${r.french.count}, not blocking)`, ...r.french.found.map((f) => `- ${f.rule} : « …${f.sample}… »`), '')
  if (r.warnings.length) lines.push('<details><summary>Warnings</summary>', '', ...r.warnings.slice(0, 20).map((w) => `- ${w}`), '', '</details>', '')
  if (r.sheet) lines.push(`Contact sheet: ${r.sheet}`, '')
}
lines.unshift('')
lines.unshift(blockingTotal ? `**${blockingTotal} blocking issue(s).** Fix them, then run QA again.` : '**No blocking issue.** Now look at the contact sheets with a critical eye.')
writeFileSync(join(outDir, 'report.md'), lines.join('\n'))
writeFileSync(join(outDir, 'report.json'), JSON.stringify(runs, null, 2))
console.log(`\nReport: ${join(outDir, 'report.md')}`)
process.exit(blockingTotal ? 1 : 0)
