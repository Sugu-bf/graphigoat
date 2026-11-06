import type { Env } from './env'
import type { Loader } from './loader'
import type { Loop } from './loop'
import type { Scroll } from './scroll'

/** Everything an effect receives besides its element. */
export interface EffectContext {
  env: Env
  loop: Loop
  scroll: Scroll
  loader: Loader
  /** Resolves when the page is ready (fonts and preloaded media in, loader gone): start intro animations here. */
  ready: Promise<void>
  /** Parsed data-options JSON of the element (empty object if none). */
  options: Record<string, unknown>
}

/** An effect is a function: it decorates one element and returns how to undo itself. */
export type Cleanup = () => void
export type EffectInit = (el: HTMLElement, ctx: EffectContext) => void | Cleanup | Promise<void | Cleanup>
export type EffectModule = { default: EffectInit }
export type ModuleMap = Record<string, () => Promise<EffectModule>>

/**
 * Mounts effects declared in the HTML:
 *
 *   <section data-effect="shader-gradient">            one effect
 *   <h2 data-effect="split-reveal scramble-text">     several, space separated
 *   data-options='{"speed": 0.4}'                      options for the effect (JSON)
 *   data-effect-media="(min-width: 900px)"            only while this media query matches
 *   data-effect-eager                                  start now instead of when close to the viewport
 *
 * Effects load lazily (their code is fetched when their element approaches the viewport), are isolated
 * (one failing effect never breaks the others) and are destroyed cleanly.
 */
export const createRegistry = (modules: ModuleMap, base: Omit<EffectContext, 'options'>) => {
  const byName = new Map<string, () => Promise<EffectModule>>()
  for (const [path, load] of Object.entries(modules)) {
    const name = path.match(/effects\/([^/]+)\/index\.ts$/)?.[1]
    if (name && !name.startsWith('_')) byName.set(name, load)
  }

  const mounted = new Map<HTMLElement, Map<string, Cleanup | undefined>>()

  const parseOptions = (el: HTMLElement): Record<string, unknown> => {
    if (!el.dataset.options) return {}
    try {
      return JSON.parse(el.dataset.options) as Record<string, unknown>
    } catch {
      console.warn('[effects] data-options is not valid JSON on', el)
      return {}
    }
  }

  const start = (el: HTMLElement, name: string) => {
    const slots = mounted.get(el) ?? new Map<string, Cleanup | undefined>()
    mounted.set(el, slots)
    if (slots.has(name)) return
    slots.set(name, undefined)
    const load = byName.get(name)
    if (!load) {
      console.warn(`[effects] "${name}" is not installed (src/effects/${name}/index.ts)`)
      return
    }
    const run = (async () => {
      try {
        const mod = await load()
        const cleanup = await mod.default(el, { ...base, options: parseOptions(el) })
        if (slots.has(name)) slots.set(name, cleanup || undefined)
        else cleanup?.()
        el.classList.add('fx-on', `fx-on-${name}`)
      } catch (err) {
        console.error(`[effects] "${name}" failed`, err)
      }
    })()
    // Effects that start before the page is revealed (the hero) are part of the loading: the loader waits for them.
    base.loader.track(run)
  }

  const stop = (el: HTMLElement, name: string) => {
    const slots = mounted.get(el)
    if (!slots?.has(name)) return
    try {
      slots.get(name)?.()
    } catch (err) {
      console.error(`[effects] cleanup of "${name}" failed`, err)
    }
    slots.delete(name)
    el.classList.remove(`fx-on-${name}`)
  }

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue
        observer.unobserve(entry.target)
        const el = entry.target as HTMLElement
        names(el).forEach((n) => activate(el, n))
      }
    },
    // One screen ahead: the code is there before the element is.
    { rootMargin: '100% 0px 100% 0px' },
  )

  const names = (el: HTMLElement) => (el.dataset.effect ?? '').split(/\s+/).filter(Boolean)

  // Media-gated effects start and stop with their query (e.g. a horizontal gallery on large screens only).
  const activate = (el: HTMLElement, name: string) => {
    const media = el.dataset.effectMedia
    if (!media) return void start(el, name)
    const mq = window.matchMedia(media)
    const apply = () => (mq.matches ? start(el, name) : stop(el, name))
    mq.addEventListener('change', apply)
    apply()
  }

  const mount = (root: ParentNode = document) => {
    for (const el of root.querySelectorAll<HTMLElement>('[data-effect]')) {
      if (el.hasAttribute('data-effect-eager')) names(el).forEach((n) => activate(el, n))
      else observer.observe(el)
    }
  }

  const destroy = () => {
    observer.disconnect()
    for (const [el, slots] of mounted) for (const name of [...slots.keys()]) stop(el, name)
    mounted.clear()
  }

  return { mount, destroy, has: (name: string) => byName.has(name), names: () => [...byName.keys()] }
}

export type Registry = ReturnType<typeof createRegistry>
