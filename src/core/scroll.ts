import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import Lenis from 'lenis'
import 'lenis/dist/lenis.css'
import type { Env } from './env'
import { ease } from './motion'

gsap.registerPlugin(ScrollTrigger)

type ScrollListener = (state: { y: number; velocity: number; progress: number }) => void

/**
 * Smooth scroll (Lenis) synchronised with ScrollTrigger and GSAP's ticker.
 * - Native scrolling when the visitor prefers reduced motion (and on touch, where Lenis keeps native by default).
 * - Anchor links glide to their target and move keyboard focus there.
 * - velocity is exposed for effects that react to scroll speed (marquees, skew, WebGL).
 */
export const createScroll = (env: Env) => {
  let lenis: Lenis | null = null
  const listeners = new Set<ScrollListener>()
  let lastY = window.scrollY
  let nativeVelocity = 0

  const emit = (y: number, velocity: number) => {
    const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight)
    listeners.forEach((fn) => fn({ y, velocity, progress: y / max }))
  }

  const raf = (time: number) => lenis?.raf(time * 1000)

  const onNativeScroll = () => {
    const y = window.scrollY
    nativeVelocity = y - lastY
    lastY = y
    emit(y, nativeVelocity)
  }

  const enable = () => {
    if (lenis) return
    window.removeEventListener('scroll', onNativeScroll)
    lenis = new Lenis({ autoRaf: false, lerp: 0.1, smoothWheel: true, anchors: false })
    lenis.on('scroll', (l: Lenis) => {
      ScrollTrigger.update()
      emit(l.scroll, l.velocity)
    })
    gsap.ticker.add(raf)
    gsap.ticker.lagSmoothing(0)
  }

  const disable = () => {
    if (lenis) {
      gsap.ticker.remove(raf)
      lenis.destroy()
      lenis = null
    }
    window.addEventListener('scroll', onNativeScroll, { passive: true })
  }

  const headerOffset = () => {
    const header = document.querySelector<HTMLElement>('[data-scroll-offset]')
    return header ? header.offsetHeight : 0
  }

  /** Scroll to an element, a selector or a position. */
  const to = (target: HTMLElement | string | number, opts: { offset?: number; immediate?: boolean } = {}) => {
    const el = typeof target === 'string' ? document.querySelector<HTMLElement>(target) : target
    if (el === null) return
    const offset = opts.offset ?? -headerOffset()
    if (lenis) {
      lenis.scrollTo(el, { offset, immediate: opts.immediate, duration: 1.4, easing: (t) => ease.inOut(t) })
    } else {
      const y = typeof el === 'number' ? el : el.getBoundingClientRect().top + window.scrollY + offset
      window.scrollTo({ top: y, behavior: opts.immediate || env.reducedMotion ? 'auto' : 'smooth' })
    }
  }

  // Anchor links: glide, then give focus to the target so keyboard and screen reader users land there too.
  const onClick = (e: MouseEvent) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
    const link = (e.target as Element | null)?.closest?.('a[href^="#"]') as HTMLAnchorElement | null
    if (!link) return
    const id = decodeURIComponent(link.hash.slice(1))
    const target = id ? document.getElementById(id) : document.body
    if (!target) return
    e.preventDefault()
    to(target === document.body ? 0 : target)
    if (target !== document.body) {
      if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1')
      target.focus({ preventScroll: true })
      history.pushState(null, '', `#${id}`)
    }
  }

  let offMotion: (() => void) | null = null
  const init = () => {
    if (env.reducedMotion) disable()
    else enable()
    offMotion = env.onMotionChange((reduced) => (reduced ? disable() : enable()))
    document.addEventListener('click', onClick)
    // Text metrics change when web fonts arrive: recompute every trigger once they are there.
    document.fonts?.ready.then(() => ScrollTrigger.refresh())
  }

  return {
    init,
    to,
    /** Freeze the page (menus, dialogs, loader). */
    stop: () => (lenis ? lenis.stop() : document.documentElement.classList.add('is-scroll-locked')),
    start: () => (lenis ? lenis.start() : document.documentElement.classList.remove('is-scroll-locked')),
    onScroll(fn: ScrollListener) {
      listeners.add(fn)
      return () => listeners.delete(fn)
    },
    get velocity() {
      return lenis ? lenis.velocity : nativeVelocity
    },
    get lenis() {
      return lenis
    },
    refresh: () => ScrollTrigger.refresh(),
    /** Removes Lenis and every listener (single-page apps, before leaving the page). */
    destroy() {
      offMotion?.()
      document.removeEventListener('click', onClick)
      window.removeEventListener('scroll', onNativeScroll)
      if (lenis) {
        gsap.ticker.remove(raf)
        lenis.destroy()
        lenis = null
      }
      listeners.clear()
    },
  }
}

export type Scroll = ReturnType<typeof createScroll>
