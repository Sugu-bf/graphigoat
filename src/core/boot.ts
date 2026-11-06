import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { bindMotionToggles } from './a11y'
import { applyEnvClasses, env } from './env'
import { createLoader } from './loader'
import { loop } from './loop'
import { createRegistry, type ModuleMap } from './registry'
import { createReveals } from './reveal'
import { createScroll } from './scroll'
import { applyFrenchTypography } from './typo'

const frame = () => new Promise<void>((r) => requestAnimationFrame(() => r()))

/**
 * Starts the page: environment classes, smooth scroll, effects, reveals, loader.
 * main.ts passes the effect modules found in src/effects (import.meta.glob), so adding an effect is only
 * copying its folder and writing data-effect="its-name" in the HTML.
 *
 * Whatever happens, the page ends with html.fx-ready: the CSS stops hiding content waiting for a reveal,
 * so a failing script can never leave the visitor in front of an empty page.
 */
export const boot = async (modules: ModuleMap) => {
  const html = document.documentElement
  html.classList.add('fx')
  applyEnvClasses()
  env.onMotionChange(applyEnvClasses)
  bindMotionToggles(env)
  // Before anything splits text into lines or letters.
  applyFrenchTypography()

  const scroll = createScroll(env)
  const loader = createLoader(env)
  const ready = loader.done
  const registry = createRegistry(modules, { env, loop, scroll, loader, ready })
  const reveals = createReveals(env, ready)

  try {
    scroll.init()
    // While a loader covers the page, the page does not scroll.
    if (loader.element) scroll.stop()
    registry.mount()
    reveals.init()
    // Let the effects close to the viewport register what they load, then wait for it.
    await frame()
    await frame()
    await loader.seal()
  } catch (err) {
    console.error('[boot]', err)
    loader.element?.remove()
  } finally {
    scroll.start()
    html.classList.add('fx-ready')
    window.dispatchEvent(new CustomEvent('lf:ready'))
  }

  /** Undoes everything boot did (effects, reveals, smooth scroll, triggers): for single-page apps leaving the page. */
  const destroy = () => {
    registry.destroy()
    reveals.destroy()
    scroll.destroy()
    ScrollTrigger.getAll().forEach((t) => t.kill())
  }

  return { env, scroll, loop, loader, registry, reveals, ready, destroy }
}

export type App = Awaited<ReturnType<typeof boot>>
