import { SplitText } from 'gsap/SplitText'
import { gsap } from 'gsap'

gsap.registerPlugin(SplitText)

/**
 * SplitText, accessible on any element: the visible text is split inside an aria-hidden wrapper, and an intact
 * copy is kept for screen readers (visually hidden). Valid ARIA everywhere (aria-label is not allowed on <p>
 * or <span>), and translation tools still see one sentence.
 */
export const splitAccessible = (el: HTMLElement, vars: SplitText.Vars) => {
  const text = (el.textContent ?? '').replace(/\s+/g, ' ').trim()
  const visual = document.createElement('span')
  visual.className = 'split-visual'
  visual.setAttribute('aria-hidden', 'true')
  visual.style.display = getComputedStyle(el).display.startsWith('inline') ? 'inline-block' : 'block'
  visual.append(...Array.from(el.childNodes))
  const reader = document.createElement('span')
  reader.className = 'sr-only'
  reader.textContent = text
  el.append(visual, reader)
  const split = SplitText.create(visual, { ...vars, aria: 'none' })
  return {
    split,
    visual,
    revert() {
      split.revert()
      el.replaceChildren(...Array.from(visual.childNodes))
    },
  }
}
