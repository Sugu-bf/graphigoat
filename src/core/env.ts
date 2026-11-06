/**
 * What the device can do and what the visitor prefers. Read once at boot; the motion preference stays live.
 *
 * Testing overrides in the address bar: ?motion=reduce, ?motion=full, ?lite (force the light mode).
 * A visitor's own choice on the site (a [data-motion-toggle] button, see a11y.ts) is remembered on the device
 * and wins over the system setting.
 */
export interface Env {
  /** The visitor asked for less motion: show the end state, keep fades short, no smooth scroll. */
  readonly reducedMotion: boolean
  /** Touch is the main pointer: no hover-only effects, no custom cursor, no magnetic pull. */
  readonly coarse: boolean
  /** Data saver or a modest device: lighter WebGL (lower resolution, fewer particles), no heavy post-processing. */
  readonly lite: boolean
  /** Device pixel ratio for rendering, capped (2, or 1.5 in light mode). */
  readonly dpr: number
  /** WebGL 2 is available. Effects that need it must provide a composed fallback when it is not. */
  readonly webgl: boolean
  /** Called when the visitor changes the motion preference while the page is open. */
  onMotionChange(fn: (reduced: boolean) => void): () => void
}

type NavigatorPlus = Navigator & { connection?: { saveData?: boolean }; deviceMemory?: number }

const query = (q: string) => window.matchMedia(q)
const MOTION_KEY = 'lf-motion'
const params = new URLSearchParams(window.location.search)
const stored = (() => {
  try {
    const v = localStorage.getItem(MOTION_KEY)
    return v === 'reduce' || v === 'full' ? v : null
  } catch {
    return null
  }
})()
const forced = params.get('motion') ?? stored
const motionQuery = query('(prefers-reduced-motion: reduce)')
const nav = navigator as NavigatorPlus

let reduced = forced ? forced === 'reduce' : motionQuery.matches
const listeners = new Set<(reduced: boolean) => void>()
motionQuery.addEventListener('change', (e) => {
  if (forced) return
  reduced = e.matches
  listeners.forEach((fn) => fn(reduced))
})

const lite =
  params.has('lite') || !!nav.connection?.saveData || (nav.deviceMemory ?? 8) <= 2 || (nav.hardwareConcurrency ?? 8) <= 2

let webglSupport: boolean | undefined
const detectWebGL = () => {
  try {
    const canvas = document.createElement('canvas')
    const gl = canvas.getContext('webgl2')
    gl?.getExtension('WEBGL_lose_context')?.loseContext()
    return !!gl
  } catch {
    return false
  }
}

export const env: Env = {
  get reducedMotion() {
    return reduced
  },
  coarse: query('(pointer: coarse)').matches && !query('(any-pointer: fine)').matches,
  lite,
  dpr: Math.min(window.devicePixelRatio || 1, lite ? 1.5 : 2),
  get webgl() {
    return (webglSupport ??= detectWebGL())
  },
  onMotionChange(fn) {
    listeners.add(fn)
    return () => listeners.delete(fn)
  },
}

/**
 * Saves the visitor's motion choice for this site and reloads the page in that mode (every effect then starts in
 * the right state; the browser keeps the scroll position). null forgets the choice and follows the system again.
 */
export const setMotionPreference = (pref: 'reduce' | 'full' | null) => {
  try {
    if (pref) localStorage.setItem(MOTION_KEY, pref)
    else localStorage.removeItem(MOTION_KEY)
  } catch {
    // storage blocked: the choice lasts for this page only
  }
  const url = new URL(window.location.href)
  if (url.searchParams.has('motion')) {
    url.searchParams.delete('motion')
    window.location.replace(url.toString())
  } else window.location.reload()
}

/** State classes on <html>, for CSS: is-reduced, is-coarse, is-lite, no-webgl. */
export const applyEnvClasses = () => {
  const html = document.documentElement
  html.classList.toggle('is-reduced', env.reducedMotion)
  html.classList.toggle('is-coarse', env.coarse)
  html.classList.toggle('is-lite', env.lite)
  html.classList.toggle('no-webgl', !env.webgl)
}
