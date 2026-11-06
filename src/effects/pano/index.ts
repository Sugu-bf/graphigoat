import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { gsap } from 'gsap'
import { pointer } from '../../core/pointer'
import type { EffectInit } from '../../core/registry'

gsap.registerPlugin(ScrollTrigger)

/**
 * The work, on the inside of a cylinder. The visitor stands in the middle of the room and the scroll turns it: the
 * card in front is flat and sharp, its neighbours curve toward the visitor like a panoramic screen (horizontal pupils
 * see wide; so does this room). The index on the side follows, and jumps to a card on click.
 *
 * Large screens only (data-effect-media); below, the same cards are a vertical list. Reduced motion: fixed cards.
 * The index under the room is a row of real buttons (keyboard and screen readers), not a decorative list.
 */
const pano: EffectInit = (el, ctx) => {
  if (ctx.env.reducedMotion) return
  const ring = el.querySelector<HTMLElement>('.pano__ring')
  const cards = Array.from(el.querySelectorAll<HTMLElement>('.wcard'))
  const index = Array.from(el.querySelectorAll<HTMLElement>('.pano__index li'))
  if (!ring || cards.length < 2) return

  el.classList.add('is-3d')
  const n = cards.length
  const step = 46 // degrees between two cards
  let radius = 900
  let tilt = { x: 0, y: 0 }
  const tiltTarget = { x: 0, y: 0 }
  let angle = 0
  let active = -1

  let persp = 1400
  const measure = () => {
    const w = cards[0]!.offsetWidth || 700
    // Chord between two neighbours = the card width plus a generous gap: neighbours never cover the front card.
    radius = (w * 1.34) / (2 * Math.sin(((step / 2) * Math.PI) / 180))
    persp = Math.round(radius * 1.3)
  }

  const render = () => {
    for (let i = 0; i < n; i++) {
      const card = cards[i]!
      const theta = i * step - angle
      const a = Math.abs(theta)
      // Far cards fade out but stay in the accessibility tree (keyboard focus turns the room to them).
      const visible = a < step * 1.65
      card.style.pointerEvents = visible ? '' : 'none'
      // Fully turned away: gone (opacity 0, still in the accessibility tree). Turning: dimmed under the veil.
      card.style.opacity = visible ? '' : '0'
      if (!visible) {
        card.style.setProperty('--veil', '1')
        continue
      }
      // Inside the cylinder: x = R·sinθ, z = R·(1 − cosθ), facing the axis. Each card carries its own perspective, so
      // the stacking order (front card on top) is decided by z-index, not by 3D depth.
      const t = ((theta + tilt.x) * Math.PI) / 180
      const x = radius * Math.sin(t)
      const z = radius * (1 - Math.cos(t))
      card.style.transform = `perspective(${persp}px) translate3d(${x.toFixed(1)}px, 0, ${z.toFixed(1)}px) rotateX(${tilt.y.toFixed(2)}deg) rotateY(${(-(theta + tilt.x)).toFixed(2)}deg)`
      card.style.setProperty('--veil', String((1 - Math.max(0, Math.min(1, 1.9 - a / step))).toFixed(3)))
      card.style.zIndex = String(100 - Math.round(a))
      card.style.filter = a > step * 0.5 ? `brightness(${(1 - Math.min(0.35, (a / step) * 0.22)).toFixed(3)})` : ''
    }
    const now = Math.max(0, Math.min(n - 1, Math.round(angle / step)))
    if (now !== active) {
      active = now
      index.forEach((li, i) => {
        li.classList.toggle('is-active', i === now)
        li.querySelector('button')?.setAttribute('aria-current', String(i === now))
      })
    }
  }

  measure()
  const st = ScrollTrigger.create({
    trigger: el,
    start: 'top top',
    end: 'bottom bottom',
    scrub: true,
    onUpdate: (self) => {
      angle = self.progress * (n - 1) * step
      render()
    },
    onRefresh: () => {
      measure()
      render()
    },
  })
  angle = st.progress * (n - 1) * step
  render()

  // A little life: the room leans toward the pointer.
  const offPointer = pointer.on((p) => {
    tiltTarget.x = p.nx * 2.2
    tiltTarget.y = -p.ny * 1.4
  })
  const offLoop = ctx.loop.add((_t, delta) => {
    const k = 1 - Math.exp(-3 * delta)
    const dx = tiltTarget.x - tilt.x
    const dy = tiltTarget.y - tilt.y
    if (Math.abs(dx) + Math.abs(dy) < 0.001) return
    tilt = { x: tilt.x + dx * k, y: tilt.y + dy * k }
    render()
  })

  // The index jumps to a project.
  const onIndex = (e: Event) => {
    const li = (e.target as Element).closest('li')
    const i = li ? index.indexOf(li as HTMLElement) : -1
    if (i < 0) return
    const y = st.start + ((st.end - st.start) * i) / (n - 1)
    ctx.scroll.to(y + 1, { offset: 0 })
  }
  // Keyboard: focusing a card's button turns the room to that card.
  const onFocus = (e: FocusEvent) => {
    const i = cards.findIndex((c) => c.contains(e.target as Node))
    if (i < 0 || i === active) return
    ctx.scroll.to(st.start + ((st.end - st.start) * i) / (n - 1) + 1, { offset: 0, immediate: true })
  }
  ring.addEventListener('focusin', onFocus)
  ring.setAttribute('data-step-visual', '')
  const list = el.querySelector('.pano__index')
  list?.addEventListener('click', onIndex)
  index.forEach((li) => (li.style.cursor = 'pointer'))

  const cleanup = () => {
    st.kill()
    offPointer()
    offLoop()
    list?.removeEventListener('click', onIndex)
    ring.removeEventListener('focusin', onFocus)
    ring.removeAttribute('data-step-visual')
    el.classList.remove('is-3d')
    for (const c of cards) {
      c.style.transform = c.style.zIndex = c.style.filter = c.style.pointerEvents = c.style.opacity = ''
      c.style.removeProperty('--veil')
    }
  }
  // If the system switches to reduced motion during the visit, the room stops and the cards lay flat.
  const offMotion = ctx.env.onMotionChange((reducedNow) => {
    if (reducedNow) cleanup()
  })
  return () => {
    offMotion()
    cleanup()
  }
}

export default pano
