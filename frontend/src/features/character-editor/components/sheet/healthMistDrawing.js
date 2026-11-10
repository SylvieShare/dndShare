const tau = Math.PI * 2
const rgba = (color, alpha) => 'rgba(' + color.match(/[\d.]+/g).slice(0, 3).join(',') + ',' + alpha + ')'

// The same normalized cloud/edge geometry is drawn by Android HealthMistDrawing.
export function drawHealthMist(ctx, width, height, fill, temporary, echo, phase, color, temporaryColor) {
  ctx.clearRect(0, 0, width, height)
  if (echo > fill) {
    ctx.fillStyle = rgba(color, .15)
    ctx.fillRect(0, 0, width * echo, height)
  }
  function segment(left, right, ink, offset) {
    if (right <= left) return
    const start = width * left, end = width * right, extent = end - start
    ctx.save()
    ctx.beginPath()
    ctx.moveTo(start, 0)
    for (let step = 0; step <= 12; step++) {
      const y = height * step / 12
      const wave = Math.sin(step / 12 * tau + phase * 1.3 + offset) * Math.sin(step / 12 * Math.PI)
      const edge = right >= .999 ? end : Math.min(width, Math.max(start, end + wave * Math.min(4, extent * .1)))
      ctx.lineTo(edge, y)
    }
    ctx.lineTo(start, height)
    ctx.closePath()
    ctx.clip()
    const liquid = ctx.createLinearGradient(0, 0, 0, height)
    liquid.addColorStop(0, rgba(ink, .66))
    liquid.addColorStop(.45, rgba(ink, .30))
    liquid.addColorStop(1, rgba(ink, .64))
    ctx.fillStyle = liquid
    ctx.fillRect(start, 0, extent + 5, height)
    for (let i = 0; i < 6; i++) {
      const x = start + ((i * .193 + phase / tau * .17 + offset) % 1) * extent
      const y = height * (.5 + Math.sin(phase * .63 + i * 2.1) * .28)
      const radius = height * (1.5 + (i % 3) * .35)
      ctx.save()
      ctx.translate(x, y)
      ctx.scale(1, .42)
      const fog = ctx.createRadialGradient(0, 0, 0, 0, 0, radius)
      fog.addColorStop(0, rgba(ink, .42))
      fog.addColorStop(.45, rgba(ink, .19))
      fog.addColorStop(1, rgba(ink, 0))
      ctx.fillStyle = fog
      ctx.fillRect(-radius, -radius, radius * 2, radius * 2)
      ctx.restore()
    }
    ctx.fillStyle = 'rgba(255,255,255,.15)'
    ctx.fillRect(start, 1, extent, 1)
    for (let i = 0; i < 4; i++) {
      const travel = (phase / tau * .27 + i * .237) % 1
      ctx.beginPath()
      ctx.arc(start + extent * ((i * .281 + .1) % 1), height * (1 - travel), .7, 0, tau)
      ctx.fillStyle = 'rgba(255,255,255,' + (Math.sin(travel * Math.PI) * .32) + ')'
      ctx.fill()
    }
    ctx.restore()
  }
  segment(0, fill, color, 0)
  segment(fill, Math.min(1, fill + temporary), temporaryColor, .47)
}
