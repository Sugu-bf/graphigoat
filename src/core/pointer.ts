/**
 * One shared pointer for every effect (a single passive listener).
 * x, y: client pixels · nx, ny: -1 → 1 across the viewport (ny up) · active: the pointer has moved at least once.
 */
type PointerListener = (p: PointerState) => void

export interface PointerState {
  x: number
  y: number
  nx: number
  ny: number
  active: boolean
  type: string
}

const state: PointerState = {
  x: window.innerWidth / 2,
  y: window.innerHeight / 2,
  nx: 0,
  ny: 0,
  active: false,
  type: 'mouse',
}
const listeners = new Set<PointerListener>()

const onMove = (e: PointerEvent) => {
  state.x = e.clientX
  state.y = e.clientY
  state.nx = (e.clientX / window.innerWidth) * 2 - 1
  state.ny = -((e.clientY / window.innerHeight) * 2 - 1)
  state.active = true
  state.type = e.pointerType
  listeners.forEach((fn) => fn(state))
}

let bound = false
const bind = () => {
  if (bound) return
  bound = true
  window.addEventListener('pointermove', onMove, { passive: true })
  window.addEventListener('pointerdown', onMove, { passive: true })
}

export const pointer = {
  get state(): Readonly<PointerState> {
    bind()
    return state
  },
  on(fn: PointerListener) {
    bind()
    listeners.add(fn)
    return () => listeners.delete(fn)
  },
  /** Position relative to an element's box: 0 → 1 on each axis (may exceed while outside). */
  local(el: Element) {
    const r = el.getBoundingClientRect()
    return { u: (state.x - r.left) / (r.width || 1), v: (state.y - r.top) / (r.height || 1), rect: r }
  },
}
