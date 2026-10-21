// Keep the same apparent marker and dash sizes in the canvas and its magnified crop.
export function mapDrawingUnits(image, scale) {
  const drawing = Math.min(2.2, .4 + Math.max(image.width, image.height) / 1200 * scale)
  return { route: .64 * drawing / scale, marker: .64 * Math.max(1, drawing) / scale }
}

export function mapPointAnchor(point, image, scale, color) {
  return { left: `${point.x * image.width}px`, top: `${point.y * image.height}px`, '--route-color': color, transform: `scale(${scale}) translate(-50%, -50%)` }
}

export function pointPreviewView(point, image, scale, bounds) {
  const zoom = scale * 2
  return { width: `${image.width}px`, height: `${image.height}px`, transform: `translate(${bounds.width / 2 - point.x * image.width * zoom}px, ${bounds.height / 2 - point.y * image.height * zoom}px) scale(${zoom})` }
}
