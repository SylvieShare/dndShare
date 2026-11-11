import { drawHealthMist } from './healthMistDrawing'
import { motionTokens } from '@/app/design-tokens'
const fillDuration = motionTokens['health-fill'], trailDuration = motionTokens['health-trail'], trailDelay = motionTokens['health-trail-delay']
const settling = trailDuration + trailDelay

const ease = t => 1 - Math.pow(1 - Math.max(0, Math.min(1, t)), 3)
const blend = (a, b, t) => a + (b - a) * t

export function createHealthMistRenderer(canvas, track) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return { update() {}, destroy() {} }
  const motion = matchMedia('(prefers-reduced-motion: reduce)')
  let target, from, started = 0, frame = 0, lastPaint = -Infinity, visible = true, destroyed = false
  let width = 0, height = 0, pixelRatio = 1
  let visualTime = 0, previousPaint = null
  function sample(now) {
    const elapsed = now - started
    return {
      fill: blend(from.fill, target.fill, ease(elapsed / fillDuration)),
      temporary: blend(from.temporary, target.temporary, ease(elapsed / fillDuration)),
      echo: blend(from.echo, target.fill, ease((elapsed - trailDelay) / trailDuration)),
    }
  }
  function active() { return !destroyed && visible && !document.hidden && !motion.matches }
  function draw(now, still = false) {
    if (!target || !width || !height) return
    const value = still ? { ...target, echo: target.fill } : sample(now)
    ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)
    drawHealthMist(ctx, width, height, value.fill, value.temporary, value.echo,
      visualTime / motionTokens['health-cycle'] * Math.PI * 2, target.color, target.temporaryColor,
      still ? 0 : Math.min(1, Math.abs(target.fill - value.fill) * 5))
  }
  function tick(now) {
    frame = 0
    if (!active()) return
    if (now - started < settling || now - lastPaint >= 1000 / 24) {
      if (previousPaint !== null) visualTime += Math.max(0, now - previousPaint)
      previousPaint = now
      draw(now)
      lastPaint = now
    }
    if (target && (target.fill > 0 || target.temporary > 0 || now - started < settling))
      frame = requestAnimationFrame(tick)
    else draw(now, true)
  }
  function resume() {
    cancelAnimationFrame(frame)
    frame = 0
    if (!target) return
    if (active()) frame = requestAnimationFrame(tick)
    else {
      previousPaint = null
      const now = performance.now()
      if (now - started < settling) {
        from = { ...target, echo: target.fill }
        started = now - settling
        draw(now, true)
      }
    }
  }
  function resize() {
    width = track.clientWidth
    height = track.clientHeight
    pixelRatio = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = Math.max(1, Math.round(width * pixelRatio))
    canvas.height = Math.max(1, Math.round(height * pixelRatio))
    draw(performance.now(), !active())
  }
  const sizes = new ResizeObserver(resize)
  sizes.observe(track)
  const viewport = new IntersectionObserver(entries => {
    visible = entries[0].isIntersecting
    resume()
  })
  viewport.observe(track)
  document.addEventListener('visibilitychange', resume)
  motion.addEventListener('change', resume)
  return {
    update(next) {
      const now = performance.now()
      const previous = target && from ? sample(now) : next
      from = { fill: previous.fill, temporary: previous.temporary, echo: Math.max(previous.echo ?? previous.fill, previous.fill) }
      target = next
      started = target && active() ? now : now - settling
      resize()
      resume()
    },
    destroy() {
      destroyed = true
      cancelAnimationFrame(frame)
      sizes.disconnect()
      viewport.disconnect()
      document.removeEventListener('visibilitychange', resume)
      motion.removeEventListener('change', resume)
    },
  }
}
