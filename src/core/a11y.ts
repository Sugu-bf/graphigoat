/** Small accessibility helpers shared by menus, dialogs and interactive effects. */
import { type Env, setMotionPreference } from './env'

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/** Keeps Tab inside `container` until the returned function is called; Escape calls onEscape. */
export const trapFocus = (container: HTMLElement, onEscape?: () => void) => {
  const previous = document.activeElement as HTMLElement | null
  const items = () => Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.offsetParent !== null)
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && onEscape) {
      e.preventDefault()
      onEscape()
      return
    }
    if (e.key !== 'Tab') return
    const list = items()
    if (!list.length) return
    const first = list[0]!
    const last = list[list.length - 1]!
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault()
      first.focus()
    }
  }
  document.addEventListener('keydown', onKey)
  requestAnimationFrame(() => items()[0]?.focus())
  return () => {
    document.removeEventListener('keydown', onKey)
    previous?.focus?.()
  }
}

let live: HTMLElement | null = null

/** Announces a short message to screen readers (polite). */
export const announce = (message: string) => {
  if (!live) {
    live = document.createElement('div')
    live.className = 'sr-only'
    live.setAttribute('aria-live', 'polite')
    document.body.append(live)
  }
  live.textContent = ''
  requestAnimationFrame(() => {
    if (live) live.textContent = message
  })
}

/** Marks purely decorative motion layers so assistive tech ignores them. */
export const decorative = (el: Element) => {
  el.setAttribute('aria-hidden', 'true')
  if (el instanceof HTMLElement) el.inert = true
}

/**
 * Buttons marked [data-motion-toggle] switch every animation of the site off or on (WCAG 2.2.2: moving content
 * that lasts must be pausable). Keep the label constant ("Réduire les animations"); aria-pressed carries the state.
 */
export const bindMotionToggles = (env: Env) => {
  for (const btn of document.querySelectorAll<HTMLElement>('[data-motion-toggle]')) {
    btn.setAttribute('aria-pressed', String(env.reducedMotion))
    btn.addEventListener('click', () => setMotionPreference(env.reducedMotion ? 'full' : 'reduce'))
  }
}
