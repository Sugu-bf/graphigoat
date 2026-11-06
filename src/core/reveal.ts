import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import type { Env } from './env'
import { splitAccessible } from './split'
import { dur, ease, stagger } from './motion'

gsap.registerPlugin(ScrollTrigger)

/**
 * Entrances driven by attributes, for content that simply needs to arrive well.
 *
 *   data-reveal="fade | rise | scale | mask | lines | words | chars"
 *   data-reveal-on="load"      → plays when the page is ready (hero), instead of when scrolled into view
 *   data-reveal-delay="0.2"    → seconds
 *   data-reveal-stagger="0.08" → for groups and split text
 *   data-reveal-group          → on a parent: its direct children rise one after another
 *
 * Content is never hidden without JavaScript: the CSS only hides [data-reveal] under html.fx (set by boot),
 * and a fail-safe shows everything after 9 s if the script never runs. With reduced motion, everything is
 * shown at once.
 *
 * Use reveals with restraint: one orchestrated entrance lands better than every block sliding up.
 */
export const createReveals = (env: Env, ready: Promise<void>) => {
  const cleanups: Array<() => void> = []

  const num = (el: HTMLElement, key: string, fallback: number) => {
    const v = Number.parseFloat(el.dataset[key] ?? '')
    return Number.isFinite(v) ? v : fallback
  }

  const trigger = (el: HTMLElement, play: () => gsap.core.Animation) => {
    if (el.dataset.revealOn === 'load') {
      ready.then(() => play())
      return
    }
    ScrollTrigger.create({ trigger: el, start: 'top 88%', once: true, onEnter: () => play() })
  }

  // Inline opacity 1 (not a cleared style): the CSS that hides reveals until the page is ready must not win.
  const show = (el: HTMLElement) => {
    gsap.set(el, { autoAlpha: 1, clearProps: 'transform,clipPath' })
    el.classList.add('is-revealed')
  }

  const textReveal = (el: HTMLElement, type: 'lines' | 'words' | 'chars') => {
    let anim: gsap.core.Animation | null = null
    let started = false
    const { revert } = splitAccessible(el, {
      type: type === 'chars' ? 'lines,chars' : type === 'words' ? 'lines,words' : 'lines',
      mask: 'lines',
      autoSplit: true,
      linesClass: 'split-line',
      onSplit(self) {
        const targets = type === 'chars' ? self.chars : type === 'words' ? self.words : self.lines
        anim = gsap.from(targets, {
          yPercent: 115,
          rotate: type === 'chars' ? 4 : 0,
          duration: type === 'lines' ? dur.l : dur.m,
          ease: ease.out,
          stagger: num(el, 'revealStagger', type === 'chars' ? stagger.tight : stagger.base),
          delay: num(el, 'revealDelay', 0),
          paused: !started,
        })
        gsap.set(el, { autoAlpha: 1 })
        return anim
      },
    })
    trigger(el, () => {
      started = true
      return anim ? anim.play() : gsap.set(el, { autoAlpha: 1 })
    })
    cleanups.push(revert)
  }

  const blockReveal = (el: HTMLElement, kind: string) => {
    const from: gsap.TweenVars =
      kind === 'rise'
        ? { autoAlpha: 0, y: 40 }
        : kind === 'scale'
          ? { autoAlpha: 0, scale: 0.94 }
          : kind === 'mask'
            ? { clipPath: 'inset(100% 0% 0% 0%)', autoAlpha: 1 }
            : { autoAlpha: 0 }
    const to: gsap.TweenVars =
      kind === 'mask' ? { clipPath: 'inset(0% 0% 0% 0%)' } : { autoAlpha: 1, y: 0, scale: 1 }
    gsap.set(el, from)
    trigger(el, () =>
      gsap.to(el, {
        ...to,
        duration: kind === 'mask' ? dur.l : dur.m,
        ease: kind === 'mask' ? ease.inOut : ease.out,
        delay: num(el, 'revealDelay', 0),
        onComplete: () => show(el),
      }),
    )
  }

  const groupReveal = (el: HTMLElement) => {
    const items = Array.from(el.children) as HTMLElement[]
    gsap.set(items, { autoAlpha: 0, y: 32 })
    gsap.set(el, { autoAlpha: 1 })
    trigger(el, () =>
      gsap.to(items, {
        autoAlpha: 1,
        y: 0,
        duration: dur.m,
        stagger: num(el, 'revealStagger', stagger.loose),
        delay: num(el, 'revealDelay', 0),
        onComplete: () => items.forEach(show),
      }),
    )
  }

  const init = (root: ParentNode = document) => {
    const els = Array.from(root.querySelectorAll<HTMLElement>('[data-reveal], [data-reveal-group]'))
    if (env.reducedMotion) {
      els.forEach((el) => {
        show(el)
        Array.from(el.children).forEach((c) => show(c as HTMLElement))
      })
      return
    }
    for (const el of els) {
      if (el.hasAttribute('data-reveal-group')) {
        groupReveal(el)
        continue
      }
      const kind = el.dataset.reveal || 'fade'
      if (kind === 'lines' || kind === 'words' || kind === 'chars') textReveal(el, kind)
      else blockReveal(el, kind)
    }
  }

  return {
    init,
    destroy: () => cleanups.splice(0).forEach((fn) => fn()),
  }
}
