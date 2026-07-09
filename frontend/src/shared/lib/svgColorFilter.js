export function svgColorFilter(hex) {
  if (!hex) return ''
  let norm = hex.trim()
  if (/^#[0-9a-fA-F]{3}$/.test(norm)) {
    norm = '#' + norm[1] + norm[1] + norm[2] + norm[2] + norm[3] + norm[3]
  }
  if (!/^#[0-9a-fA-F]{6}$/.test(norm)) return ''
  const r = parseInt(norm.slice(1, 3), 16) / 255
  const g = parseInt(norm.slice(3, 5), 16) / 255
  const b = parseInt(norm.slice(5, 7), 16) / 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  const l = (max + min) / 2
  let h = 0, s = 0
  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0)
    else if (max === g) h = (b - r) / d + 2
    else h = (r - g) / d + 4
    h /= 6
  }
  const hDeg = Math.round(h * 360)
  const sat = Math.min(10000, Math.round(s * 1000))
  const lit = Math.round(l * 100)
  // sepia baseline: hue ~38°, fully saturated
  return `brightness(0) saturate(100%) invert(${lit}%) sepia(100%) saturate(${sat}%) hue-rotate(${hDeg - 38}deg)`
}
