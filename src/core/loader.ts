import { gsap } from 'gsap'
import type { Env } from './env'
import { dur, ease } from './motion'

/**
 * Real loading progress, never a fake wait.
 *
 * Tracks the web fonts, every <img data-preload> / <video data-preload>, and whatever an effect registers
 * (loader.track(promise)), e.g. a 3D model. If the page has a [data-loader] element it shows the progress
 * (CSS variable --progress and any [data-loader-count] text), then plays its exit. Without one, it only
 * resolves `done` so the hero can start once its media is really there.
 *
 * A safety timeout lets the page in after `maxWait` even if a file never arrives.
 */
export const createLoader = (env: Env, opts: { maxWait?: number; minShow?: number } = {}) => {
  const maxWait = opts.maxWait ?? 6000
  const minShow = opts.minShow ?? 500
  const el = document.querySelector<HTMLElement>('[data-loader]')
  const counter = el?.querySelector<HTMLElement>('[data-loader-count]') ?? null
  const started = performance.now()

  let total = 0
  let loaded = 0
  let sealed = false
  const pending: Promise<unknown>[] = []
  let resolveDone!: () => void
  const done = new Promise<void>((r) => (resolveDone = r))
  const shown = { value: 0 }

  const render = () => {
    const p = total ? loaded / total : 1
    gsap.to(shown, {
      value: p,
      duration: 0.6,
      ease: ease.out,
      overwrite: true,
      onUpdate: () => {
        el?.style.setProperty('--progress', shown.value.toFixed(3))
        if (counter) counter.textContent = String(Math.round(shown.value * 100))
      },
    })
  }

  const track = <T>(p: Promise<T>): Promise<T> => {
    if (sealed) return p
    total += 1
    const counted = p.finally(() => {
      loaded += 1
      render()
    })
    pending.push(counted.catch(() => undefined))
    return p
  }

  const mediaReady = (m: HTMLImageElement | HTMLVideoElement) =>
    new Promise<void>((resolve) => {
      if (m instanceof HTMLImageElement) {
        if (m.complete && m.naturalWidth) return resolve()
        m.decode?.().then(resolve, resolve)
        m.addEventListener('load', () => resolve(), { once: true })
        m.addEventListener('error', () => resolve(), { once: true })
      } else {
        if (m.readyState >= 3) return resolve()
        m.addEventListener('canplay', () => resolve(), { once: true })
        m.addEventListener('error', () => resolve(), { once: true })
      }
    })

  const exit = async () => {
    if (!el) return
    const wait = Math.max(0, minShow - (performance.now() - started))
    await new Promise((r) => setTimeout(r, wait))
    if (env.reducedMotion) {
      el.remove()
      return
    }
    await gsap
      .timeline()
      .to(el.querySelectorAll('[data-loader-content]'), { autoAlpha: 0, y: -16, duration: dur.s, ease: ease.in })
      .to(el, { clipPath: 'inset(0% 0% 100% 0%)', duration: dur.l, ease: ease.inOut }, '-=0.1')
      .then()
    el.remove()
  }

  /** Call once every effect had the chance to register what it needs (boot does it). */
  const seal = async () => {
    if (sealed) return done
    sealed = true
    if (!total) render()
    const timeout = new Promise((r) => setTimeout(r, maxWait))
    await Promise.race([Promise.all(pending), timeout])
    await exit()
    document.documentElement.classList.add('is-ready')
    resolveDone()
    return done
  }

  // What every page waits for: its fonts and the media marked as essential.
  if (document.fonts) track(document.fonts.ready)
  document
    .querySelectorAll<HTMLImageElement | HTMLVideoElement>('img[data-preload], video[data-preload]')
    .forEach((m) => track(mediaReady(m)))

  return { track, seal, done, element: el }
}

export type Loader = ReturnType<typeof createLoader>
