export const ROW_ACTION_MARGIN = 8
export const ROW_ACTION_GAP = 6

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), Math.max(min, max))
}

export function computeRowActionPlacement({
  triggerRect,
  popoverWidth,
  popoverHeight,
  viewportWidth,
  viewportHeight,
  viewportLeft = 0,
  viewportTop = 0,
  originX,
  originY,
  margin = ROW_ACTION_MARGIN,
  gap = ROW_ACTION_GAP,
}) {
  const minLeft = viewportLeft + margin
  const minTop = viewportTop + margin
  const maxRight = viewportLeft + viewportWidth - margin
  const maxBottom = viewportTop + viewportHeight - margin
  const width = Math.min(popoverWidth, Math.max(0, maxRight - minLeft))
  const left = clamp(triggerRect.right - width, minLeft, maxRight - width)

  const below = Math.max(0, maxBottom - triggerRect.bottom - gap)
  const above = Math.max(0, triggerRect.top - gap - minTop)
  const opensAbove = below < popoverHeight && above > below
  const maxHeight = opensAbove ? above : below
  const height = Math.min(popoverHeight, maxHeight)
  const top = opensAbove
    ? clamp(triggerRect.top - gap - height, minTop, maxBottom - height)
    : clamp(triggerRect.bottom + gap, minTop, maxBottom - height)

  return {
    left,
    top,
    maxHeight,
    opensAbove,
    originX: clamp(originX - left, 0, width),
    originY: clamp(originY - top, 0, height),
  }
}
