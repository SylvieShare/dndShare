import { toCanvas } from 'html-to-image'
import { planAncestorCrop, scrollOffsetBetween } from './screenshotGeometry'

export async function captureSelectedArea(element) {
  const rect = element.getBoundingClientRect()
  if (rect.width <= 0 || rect.height <= 0) throw new Error('empty screenshot context')
  const backgroundRoot = screenshotCaptureRoot(element)
  const scrollOffset = scrollOffsetBetween(element, backgroundRoot)
  // html-to-image does not preserve scrollTop/scrollLeft on cloned containers.
  // Capture the selected context itself when it sits inside a scrolled parent;
  // otherwise an off-screen part of the unscrolled clone lands in the crop.
  const captureRoot = scrollOffset.left || scrollOffset.top ? element : backgroundRoot
  const plan = planAncestorCrop(rect, captureRoot.getBoundingClientRect())
  if (plan.crop.width <= 0 || plan.crop.height <= 0) throw new Error('empty screenshot crop')
  const scale = Math.max(0.1, Math.min(
    window.devicePixelRatio || 1,
    2,
    2400 / plan.render.width,
    1600 / plan.render.height,
  ))
  const pageCanvas = await renderElementCanvas(captureRoot, plan.render, scale)
  return cropScreenshot(pageCanvas, plan, 0.82)
}

async function renderElementCanvas(element, render, pixelRatio) {
  return toCanvas(element, {
    backgroundColor: screenshotBackground(element),
    cacheBust: true,
    width: render.width,
    height: render.height,
    pixelRatio,
    filter: screenshotFilter,
    // The crop coordinates are already relative to the root border box. A computed
    // auto-margin would otherwise be copied inside the SVG and shift contents again.
    style: { margin: '0' },
  })
}

function cropScreenshot(source, plan, quality) {
  const scaleX = source.width / plan.render.width
  const scaleY = source.height / plan.render.height
  const output = document.createElement('canvas')
  output.width = Math.max(1, Math.round(plan.crop.width * scaleX))
  output.height = Math.max(1, Math.round(plan.crop.height * scaleY))
  const context = output.getContext('2d')
  if (!context) throw new Error('screenshot canvas unavailable')
  context.drawImage(
    source,
    plan.crop.left * scaleX,
    plan.crop.top * scaleY,
    plan.crop.width * scaleX,
    plan.crop.height * scaleY,
    0,
    0,
    output.width,
    output.height,
  )
  return {
    dataURL: checkedScreenshot(output.toDataURL('image/jpeg', quality)),
    width: plan.crop.width,
    height: plan.crop.height,
  }
}

function screenshotCaptureRoot(element) {
  let current = element
  while (current && current !== document.body) {
    if (elementPaintsBackground(current)) return current
    current = current.parentElement
  }
  return document.body
}

function elementPaintsBackground(element) {
  const style = getComputedStyle(element)
  return style.backgroundImage !== 'none' || !isTransparentColor(style.backgroundColor)
}

function isTransparentColor(color) {
  return !color || color === 'transparent' || /rgba?\([^)]*[, /]0(?:\.0+)?\s*\)$/.test(color)
}

function screenshotFilter(node) {
  return !(node instanceof Element && (
    node.matches('noscript, .am-overlay, .selection-highlight, .selection-hint, .report-toast')
    || Boolean(node.closest('[data-error-report-ignore]'))
  ))
}

function screenshotBackground(element = document.body) {
  let current = element
  while (current) {
    const color = getComputedStyle(current).backgroundColor
    if (!isTransparentColor(color)) return color
    current = current.parentElement
  }
  return '#11121a'
}

function checkedScreenshot(dataURL) {
  if (estimatedDataURLBytes(dataURL) > 2 * 1024 * 1024) throw new Error('large screenshot')
  return dataURL
}

export async function withTimeout(promise, milliseconds) {
  let timer
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error('screenshot timeout')), milliseconds)
      }),
    ])
  } finally {
    clearTimeout(timer)
  }
}

function estimatedDataURLBytes(dataURL) {
  const comma = dataURL.indexOf(',')
  if (comma < 0) return Number.POSITIVE_INFINITY
  return Math.ceil((dataURL.length - comma - 1) * 3 / 4)
}
