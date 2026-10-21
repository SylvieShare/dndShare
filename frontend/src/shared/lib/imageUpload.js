const MB = 1024 * 1024
export const IMAGE_UPLOAD_MAX_BYTES = 30 * MB
export const PORTRAIT_IMAGE_MAX_BYTES = 8 * MB
export const CHARACTER_ICON_MAX_BYTES = 5 * MB

export function validateImageFile(file, maxBytes = IMAGE_UPLOAD_MAX_BYTES) {
  if (!file?.size) throw new Error('Выберите непустое изображение')
  if (file.size > maxBytes) throw new Error(`Файл слишком большой (максимум ${maxBytes / MB} МБ)`)
  if (!file.type?.startsWith('image/')) throw new Error('Выберите файл изображения')
}

// Some browsers silently return PNG when a canvas encoder is unavailable.
export function canvasToWebp(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => {
      if (blob?.type === 'image/webp') resolve(blob)
      else reject(new Error('Не удалось преобразовать изображение в WebP'))
    }, 'image/webp', 0.9)
  })
}

// Keep the original resolution and transparency; existing WebP is not re-encoded.
// maxDimension is reserved for the character wizard's thumbnail export.
export async function prepareImageUpload(file, { maxBytes = IMAGE_UPLOAD_MAX_BYTES, maxDimension } = {}) {
  validateImageFile(file, maxBytes)
  if (file.type === 'image/webp' && !maxDimension) return file
  const source = URL.createObjectURL(file)
  const image = new Image()
  let canvas
  try {
    await new Promise((resolve, reject) => {
      image.onload = resolve
      image.onerror = () => reject(new Error('Не удалось открыть изображение. Выберите формат, поддерживаемый браузером, например PNG, JPG или WebP'))
      image.src = source
    })
    const scale = maxDimension ? Math.min(1, maxDimension / Math.max(image.naturalWidth, image.naturalHeight)) : 1
    const width = Math.max(1, Math.round(image.naturalWidth * scale))
    const height = Math.max(1, Math.round(image.naturalHeight * scale))
    if (file.type === 'image/webp' && scale === 1) return file
    if (width > 16383 || height > 16383) throw new Error('Для WebP размер изображения должен быть не больше 16383 пикселей по каждой стороне')
    canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Не удалось подготовить изображение')
    context.drawImage(image, 0, 0, width, height)
    const blob = await canvasToWebp(canvas)
    if (blob.size > maxBytes) throw new Error(`После преобразования изображение превышает ${maxBytes / MB} МБ`)
    const name = (file.name || 'image').replace(/\.[^.]+$/, '') + '.webp'
    return new File([blob], name, { type: 'image/webp', lastModified: file.lastModified })
  } finally {
    image.onload = null
    image.onerror = null
    image.src = ''
    URL.revokeObjectURL(source)
    if (canvas) { canvas.width = 0; canvas.height = 0 }
  }
}
