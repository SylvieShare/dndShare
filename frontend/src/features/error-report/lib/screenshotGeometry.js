function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max)
}

export function planAncestorCrop(rect, ancestorRect) {
  const renderWidth = Math.max(1, ancestorRect.width)
  const renderHeight = Math.max(1, ancestorRect.height)
  const cropLeft = clamp(rect.left - ancestorRect.left, 0, renderWidth)
  const cropTop = clamp(rect.top - ancestorRect.top, 0, renderHeight)
  const cropRight = clamp(rect.left + rect.width - ancestorRect.left, cropLeft, renderWidth)
  const cropBottom = clamp(rect.top + rect.height - ancestorRect.top, cropTop, renderHeight)

  return {
    render: {
      width: renderWidth,
      height: renderHeight,
    },
    crop: {
      left: cropLeft,
      top: cropTop,
      width: cropRight - cropLeft,
      height: cropBottom - cropTop,
    },
  }
}

export function scrollOffsetBetween(element, captureRoot) {
  if (element === captureRoot) return { left: 0, top: 0 }
  let left = 0
  let top = 0
  let current = element.parentElement
  while (current) {
    left += current.scrollLeft || 0
    top += current.scrollTop || 0
    if (current === captureRoot) break
    current = current.parentElement
  }
  return { left, top }
}
