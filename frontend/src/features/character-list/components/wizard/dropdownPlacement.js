export function shouldOpenDropUp(inputRect, boundary, minVisibleHeight = 180) {
  const spaceBelow = Math.max(0, boundary.bottom - inputRect.bottom)
  const spaceAbove = Math.max(0, inputRect.top - boundary.top)
  return spaceBelow < minVisibleHeight && spaceAbove > spaceBelow
}
