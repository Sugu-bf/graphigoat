// Fonts are declared in styles/tokens.css (Work Sans, Parkinsans and JetBrains Mono, local woff2 files).
import './styles/tokens.css'
import './styles/base.css'
import './styles/site.css'
import { boot } from './core/boot'
import type { EffectModule } from './core/registry'

import.meta.glob('./effects/*/style.css', { eager: true })

const app = boot(import.meta.glob<EffectModule>('./effects/*/index.ts'))

const html = document.documentElement
const fr = (html.lang || 'en').startsWith('fr')
const reduced = () => html.classList.contains('is-reduced') || matchMedia('(prefers-reduced-motion: reduce)').matches
const lerp = (a: number, b: number, k: number) => a + (b - a) * k
const clamp01 = (v: number) => Math.max(0, Math.min(1, v))

/** Header: glass background once the page has scrolled. */
function header() {
  const h = document.querySelector<HTMLElement>('[data-header]')
  if (!h) return
  const set = () => h.classList.toggle('is-scrolled', scrollY > 24)
  set()
  addEventListener('scroll', set, { passive: true })
}

/**
 * The emblem as a lit object: a stack of edge layers gives it thickness, a sheen follows the angle,
 * and it turns gently toward the pointer. The beam above it narrows as the hero scrolls away
 * (same flux, tighter angle: the light concentrates on the mark).
 */
function badge() {
  const root = document.querySelector<HTMLElement>('[data-badge]')
  const body = root?.querySelector<HTMLElement>('[data-badge-body]')
  const beam = document.querySelector<HTMLElement>('[data-beam]')
  const hero = root?.closest('section')
  if (!root || !body || !hero) return

  const face = body.querySelector('.badge__face')!
  const LAYERS = 18
  const frag = document.createDocumentFragment()
  for (let i = LAYERS; i >= 1; i--) {
    const img = document.createElement('img')
    img.src = '/brand/emblem-edge.svg'
    img.alt = ''
    img.decoding = 'async'
    img.className = 'badge__edge'
    img.setAttribute('aria-hidden', 'true')
    img.style.setProperty('--i', String(i))
    // Darker toward the back: the edge reads as a turned, lit surface.
    img.style.setProperty('--b', (1.05 - (i / LAYERS) * 0.55).toFixed(3))
    frag.append(img)
  }
  body.insertBefore(frag, face)

  const thickness = () => {
    // About 3.4% of the emblem's height, like a thick acrylic badge.
    const dz = (root.offsetHeight * 0.034) / LAYERS
    body.style.setProperty('--dz', `${dz.toFixed(3)}px`)
  }
  thickness()
  new ResizeObserver(thickness).observe(root)

  const REST = { rx: -4, ry: -16 }
  if (reduced()) {
    body.style.setProperty('--rx', `${REST.rx}deg`)
    body.style.setProperty('--ry', `${REST.ry}deg`)
    body.style.setProperty('--sheen', '58%')
    return
  }

  const fine = matchMedia('(pointer: fine)').matches
  let px = 0
  let py = 0
  let hasPointer = false
  if (fine) {
    addEventListener(
      'pointermove',
      (e) => {
        px = (e.clientX / innerWidth) * 2 - 1
        py = (e.clientY / innerHeight) * 2 - 1
        hasPointer = true
      },
      { passive: true },
    )
  }

  let visible = true
  new IntersectionObserver(([e]) => (visible = !!e?.isIntersecting)).observe(hero)

  let rx = REST.rx
  let ry = REST.ry
  let raf = 0
  const t0 = performance.now()
  const tick = (now: number) => {
    raf = requestAnimationFrame(tick)
    if (!visible) return
    const t = (now - t0) / 1000
    const p = clamp01(scrollY / (hero.offsetHeight * 0.9))

    // Idle sway, then the pointer takes over; the scroll turns it a little further.
    const idleY = Math.sin(t * 0.45) * 9
    const idleX = Math.sin(t * 0.33) * 3
    const ty = (hasPointer ? px * 18 : idleY) + REST.ry * (hasPointer ? 0.5 : 1) + p * 28
    const tx = (hasPointer ? -py * 7 : idleX) + REST.rx
    rx = lerp(rx, tx, 0.06)
    ry = lerp(ry, ty, 0.06)
    const fy = Math.sin(t * 0.9) * 6

    body.style.setProperty('--rx', `${rx.toFixed(2)}deg`)
    body.style.setProperty('--ry', `${ry.toFixed(2)}deg`)
    body.style.setProperty('--fy', `${fy.toFixed(2)}px`)
    body.style.setProperty('--sheen', `${(50 + ry * 1.6).toFixed(1)}%`)
    root.style.setProperty('--ss', (1 - fy / 90).toFixed(3))

    if (beam) {
      // From a wide flood to a tight spot as the hero leaves.
      beam.style.setProperty('--bottom', `${lerp(30, 9, p).toFixed(2)}%`)
      beam.style.setProperty('--top', `${lerp(2.2, 1, p).toFixed(2)}%`)
    }
  }
  raf = requestAnimationFrame(tick)
  addEventListener('lf:motion', () => {
    if (reduced()) cancelAnimationFrame(raf)
  })
}

/**
 * Each project opens as a datasheet (a native <dialog>, filled from its <template>). The page behind stops scrolling,
 * Escape or Close returns focus to the button that opened it.
 */
function datasheets() {
  const dialog = document.querySelector<HTMLDialogElement>('#sheet')
  const body = dialog?.querySelector<HTMLElement>('[data-sheet-body]')
  if (!dialog || !body) return
  dialog.setAttribute('data-lenis-prevent', '')
  let opener: HTMLElement | null = null
  for (const btn of document.querySelectorAll<HTMLElement>('[data-sheet-open]')) {
    const tpl = document.querySelector<HTMLTemplateElement>(`#sheet-${btn.dataset.sheetOpen}`)
    // No sheet, no button: never a dead control.
    if (!tpl) {
      btn.remove()
      continue
    }
    btn.addEventListener('click', () => {
      opener = btn
      body.replaceChildren(tpl.content.cloneNode(true))
      dialog.showModal()
      void app.then((a) => a.scroll.stop())
    })
  }
  dialog.addEventListener('click', (e) => e.target === dialog && dialog.close())
  dialog.addEventListener('close', () => {
    void app.then((a) => a.scroll.start())
    opener?.focus()
  })
}

/** Contact form: Netlify Forms over fetch, with an inline confirmation. */
function form() {
  const f = document.querySelector<HTMLFormElement>('[data-form]')
  if (!f) return
  const status = f.querySelector<HTMLElement>('[data-form-status]')!
  const T = fr
    ? {
        sending: 'Envoi…',
        ok: 'Reçu. Votre maquette arrive dans votre boîte de réception sous 48 heures.',
        fail: 'L’envoi a échoué. Réessayez, ou écrivez-moi sur Upwork.',
      }
    : {
        sending: 'Sending…',
        ok: 'Got it. Your mockup lands in your inbox within 48 hours.',
        fail: 'That didn’t go through. Try again, or message me on Upwork.',
      }
  f.addEventListener('submit', async (e) => {
    e.preventDefault()
    if (!f.reportValidity()) return
    status.textContent = T.sending
    try {
      const body = new URLSearchParams(new FormData(f) as unknown as Record<string, string>).toString()
      const res = await fetch('/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
      })
      if (!res.ok) throw new Error(String(res.status))
      f.classList.add('is-sent')
      status.textContent = T.ok
    } catch {
      status.textContent = T.fail
    }
  })
}

header()
badge()
datasheets()
form()
