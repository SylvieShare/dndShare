import { layoutTokens } from '@/app/design-tokens'
const tau = Math.PI * 2
const rgb = color => color.match(/[\d.]+/g).slice(0, 3).map(Number)
const rgba = (color, alpha, light = 0) => 'rgba(' + rgb(color).map(value => Math.round(value + (255 - value) * light)).join(',') + ',' + alpha + ')'

// Android HealthMistDrawing uses the same field geometry. The fog stays in vessel
// coordinates, so changing HP reveals it without stretching or restarting its flow.
export function drawHealthMist(ctx, width, height, fill, temporary, echo, phase, color, temporaryColor, activity = 0) {
  const unit = height / (layoutTokens['sheet-health-height'] - 2)
  ctx.clearRect(0, 0, width, height)
  if (echo > fill) { ctx.fillStyle = rgba(color, .15); ctx.fillRect(0, 0, width * echo, height) }
  function segment(left, right, ink, offset) {
    if (right <= left) return
    const start = width * left, end = width * right, extent = end - start
    const front = []
    ctx.save()
    ctx.beginPath()
    ctx.moveTo(start, 0)
    for (let step = 0; step <= 24; step++) {
      const t = step / 24, y = height * t
      const wave = (Math.sin(t * tau + phase * .65 + offset) * .7 + Math.sin(t * tau * 2 - phase * .43) * .3) * Math.sin(t * Math.PI)
      const edge = right >= .999 ? end : Math.min(width, Math.max(start, end + wave * Math.min((1.4 + 3.4 * activity) * unit, extent * .1)))
      front.push([edge, y])
      ctx.lineTo(edge, y)
    }
    ctx.lineTo(start, height)
    ctx.closePath()
    ctx.clip()
    const liquid = ctx.createLinearGradient(0, 0, 0, height)
    liquid.addColorStop(0, rgba(ink, .52))
    liquid.addColorStop(.5, rgba(ink, .23))
    liquid.addColorStop(1, rgba(ink, .52))
    ctx.fillStyle = liquid
    ctx.fillRect(start, 0, extent + 6 * unit, height)
    for (let layer = 0; layer < 2; layer++) for (let i = 0; i < 5; i++) {
      const speed = layer ? -.031 : .047
      const q = i * .217 + phase / tau * speed + offset
      const x = ((q % 1 + 1) % 1) * width
      const y = height * (.48 + Math.sin(phase * (.35 + layer * .13) + i * 1.83) * .22)
      const radius = height * (layer ? 1.1 : 1.85) * (1 + Math.sin(phase * .23 + i) * .08)
      for (let tile = -1; tile <= 1; tile++) {
        const px = x + tile * width
        if (px + radius < start || px - radius > end + 6 * unit) continue
        ctx.save()
        ctx.translate(px, y)
        ctx.scale(1, layer ? .5 : .32)
        const fog = ctx.createRadialGradient(0, 0, 0, 0, 0, radius)
        fog.addColorStop(0, rgba(ink, layer ? .22 : .32, layer ? .25 : 0))
        fog.addColorStop(.5, rgba(ink, layer ? .10 : .14))
        fog.addColorStop(1, rgba(ink, 0))
        ctx.fillStyle = fog
        ctx.fillRect(-radius, -radius, radius * 2, radius * 2)
        ctx.restore()
      }
    }
    if (right < .999) {
      ctx.beginPath()
      front.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))
      ctx.strokeStyle = rgba(ink, .18 + activity * .3, .55)
      ctx.lineWidth = unit
      ctx.stroke()
    }
    ctx.fillStyle = 'rgba(255,255,255,.12)'
    ctx.fillRect(start, unit, extent, unit)
    for (let i = 0; i < 4; i++) {
      const travel = (phase / tau * .2 + i * .237) % 1
      ctx.beginPath()
      ctx.arc(width * ((i * .281 + .1) % 1), height * (1 - travel), .7 * unit, 0, tau)
      ctx.fillStyle = 'rgba(255,255,255,' + (Math.sin(travel * Math.PI) * .25) + ')'
      ctx.fill()
    }
    ctx.restore()
  }
  segment(0, fill, color, 0)
  segment(fill, Math.min(1, fill + temporary), temporaryColor, .47)
}
