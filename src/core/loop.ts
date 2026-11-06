import { gsap } from 'gsap'

/** time and delta in seconds */
export type Tick = (time: number, delta: number) => void

/**
 * One animation frame loop for the whole page: GSAP's ticker drives Lenis, ScrollTrigger and every WebGL scene,
 * so scroll, tweens and rendering stay in the same frame (no jitter between DOM and canvas).
 */
export const loop = {
  add(fn: Tick): () => void {
    const cb = (time: number, deltaMs: number) => fn(time, deltaMs / 1000)
    gsap.ticker.add(cb)
    return () => gsap.ticker.remove(cb)
  },
  /** Current frame rate cap (GSAP default: the display rate). */
  fps(value: number) {
    gsap.ticker.fps(value)
  },
}

export type Loop = typeof loop
