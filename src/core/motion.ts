import { gsap } from 'gsap'
import { CustomEase } from 'gsap/CustomEase'

gsap.registerPlugin(CustomEase)

/**
 * Motion tokens: the page's vocabulary of timing. Tune them per project (direction.md decides the personality),
 * then use only these names so the whole site moves with one voice. Mirrors --ease-* and --dur-* in tokens.css.
 */
export const ease = {
  /** decisive arrival: entrances, reveals, things settling into place */
  out: CustomEase.create('lf-out', '0.16, 1, 0.3, 1'),
  /** calm travel from A to B: transitions, camera moves, scrubbed timelines */
  inOut: CustomEase.create('lf-in-out', '0.65, 0, 0.35, 1'),
  /** leaving the stage: exits, closing panels */
  in: CustomEase.create('lf-in', '0.55, 0, 1, 0.45'),
  /** quick, precise answers to a gesture: hover, press, toggles */
  snap: CustomEase.create('lf-snap', '0.2, 0.9, 0.1, 1'),
  /** no easing: scrubbed by scroll, where the scroll itself is the easing */
  none: 'none',
} as const

/** Durations in seconds. Large type and big surfaces deserve the longer values; UI answers the short ones. */
export const dur = { xs: 0.25, s: 0.5, m: 0.9, l: 1.3, xl: 2 } as const

/** Delay between items of a group. */
export const stagger = { tight: 0.03, base: 0.06, loose: 0.12 } as const

gsap.defaults({ ease: ease.out, duration: dur.m })

/** Linear interpolation, clamped mapping and a frame-rate independent damping, for hand-written loops. */
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t
export const clamp = (v: number, min = 0, max = 1) => Math.min(max, Math.max(min, v))
export const damp = (current: number, target: number, lambda: number, dt: number) =>
  lerp(current, target, 1 - Math.exp(-lambda * dt))
