import type { EffectInit } from '../../core/registry'

/**
 * A project's loop inside its stadium frame: the video loads only when the frame comes near, plays while it is
 * on screen, pauses when it leaves. A small Pause / Play button keeps it under the visitor's control (WCAG 2.2.2).
 * Reduced motion: the poster only, with a Play button for those who want it.
 */
const workMedia: EffectInit = (el, { env }) => {
  const video = el.querySelector<HTMLVideoElement>('video')
  if (!video) return
  const fr = (document.documentElement.lang || 'en').startsWith('fr')
  const labels = fr ? { pause: 'Mettre en pause', play: 'Lire' } : { pause: 'Pause', play: 'Play' }

  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'media-toggle'
  button.hidden = !video.dataset.src
  el.append(button)

  let userPaused = env.reducedMotion
  let visible = false
  let loaded = false

  const load = () => {
    if (loaded || !video.dataset.src) return
    loaded = true
    // Phones get the lighter file.
    video.src = window.innerWidth < 760 && video.dataset.srcSmall ? video.dataset.srcSmall : video.dataset.src
    video.load()
  }
  const sync = () => {
    const play = visible && !userPaused
    if (play) {
      load()
      video.play().catch(() => {})
    } else video.pause()
    button.textContent = play ? labels.pause : labels.play
    button.setAttribute('aria-pressed', String(!play))
  }
  const onError = () => el.classList.add('is-poster-only')
  const onPlaying = () => el.classList.add('is-playing')
  video.addEventListener('error', onError)
  video.addEventListener('playing', onPlaying)

  const io = new IntersectionObserver(
    ([entry]) => {
      visible = !!entry && entry.intersectionRatio > 0.3
      sync()
    },
    { threshold: [0, 0.3, 0.6] },
  )
  io.observe(el)
  const onClick = () => {
    userPaused = !userPaused
    sync()
  }
  button.addEventListener('click', onClick)
  sync()

  return () => {
    io.disconnect()
    button.removeEventListener('click', onClick)
    video.removeEventListener('error', onError)
    video.removeEventListener('playing', onPlaying)
    video.pause()
    button.remove()
  }
}

export default workMedia
