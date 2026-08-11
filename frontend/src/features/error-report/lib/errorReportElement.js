import { platformForViewport } from './errorReportContext'

const semanticAncestorTags = new Set([
  'article', 'aside', 'dialog', 'fieldset', 'footer', 'form', 'header', 'main', 'nav', 'section',
])

export function screenshotContextsFor(element) {
  const contexts = [element]
  let current = element.parentElement
  while (current && current !== document.body && current !== document.documentElement && contexts.length < 4) {
    contexts.push(current)
    current = current.parentElement
  }
  return contexts
}

export function describeElement(element) {
  const rect = element.getBoundingClientRect()
  const text = normalizeText(element.innerText || element.textContent || '')
  const classNames = (element.getAttribute('class') || '')
    .split(/\s+/)
    .map(value => value.trim())
    .filter(Boolean)
    .slice(0, 12)

  return compactObject({
    selector: selectorFor(element),
    tagName: element.tagName.toLowerCase(),
    id: element.id || undefined,
    classNames: classNames.length ? classNames : undefined,
    text: text || undefined,
    ariaLabel: element.getAttribute('aria-label') || undefined,
    title: element.getAttribute('title') || undefined,
    name: element.getAttribute('name') || undefined,
    type: element.getAttribute('type') || undefined,
    ancestorContext: ancestorContextFor(element),
    rect: {
      x: Math.round(rect.x),
      y: Math.round(rect.y),
      width: Math.round(rect.width),
      height: Math.round(rect.height),
    },
    viewport: {
      width: window.innerWidth,
      height: window.innerHeight,
    },
    platform: platformForViewport(window.innerWidth),
  })
}

function ancestorContextFor(element) {
  const ancestors = []
  let current = element.parentElement
  while (current && current !== document.body && current !== document.documentElement && ancestors.length < 5) {
    const descriptor = semanticAncestorDescriptor(current)
    if (descriptor) ancestors.push(descriptor)
    current = current.parentElement
  }
  return ancestors.reverse()
}

function semanticAncestorDescriptor(element) {
  const tagName = element.tagName.toLowerCase()
  const hasIdentity = Boolean(
    element.id
    || element.getAttribute('class')?.trim()
    || element.hasAttribute('data-testid')
    || element.hasAttribute('data-test')
    || element.getAttribute('role')
    || element.getAttribute('aria-label')
    || semanticAncestorTags.has(tagName),
  )
  if (!hasIdentity) return null

  return compactObject({
    selectorPart: semanticSelectorPart(element),
    role: element.getAttribute('role') || undefined,
    ariaLabel: element.getAttribute('aria-label') || undefined,
    title: element.getAttribute('title') || undefined,
  })
}

export function selectorFor(element) {
  if (element.id) {
    const byID = `#${escapeCSS(element.id)}`
    if (isUniqueSelector(byID)) return byID
  }

  const parts = []
  let current = element
  while (current && current !== document.documentElement && parts.length < 8) {
    parts.unshift(semanticSelectorPart(current))
    const candidate = parts.join(' > ')
    if (isUniqueSelector(candidate)) return candidate
    current = current.parentElement
  }
  return parts.join(' > ') || element.tagName.toLowerCase()
}

function semanticSelectorPart(element) {
  if (element.id) return `#${escapeCSS(element.id)}`

  const tagName = element.tagName.toLowerCase()
  const testAttribute = element.hasAttribute('data-testid')
    ? 'data-testid'
    : (element.hasAttribute('data-test') ? 'data-test' : '')
  if (testAttribute) {
    return `${tagName}[${testAttribute}="${escapeAttribute(element.getAttribute(testAttribute))}"]`
  }

  const classes = (element.getAttribute('class') || '')
    .split(/\s+/)
    .map(value => value.trim())
    .filter(Boolean)
    .slice(0, 6)
  if (classes.length) {
    return `${tagName}${classes.map(className => `.${escapeCSS(className)}`).join('')}`
  }

  return tagName
}

function isUniqueSelector(selector) {
  try {
    return document.querySelectorAll(selector).length === 1
  } catch {
    return false
  }
}

function escapeCSS(value) {
  if (window.CSS?.escape) return window.CSS.escape(value)
  return value.replace(/[^a-zA-Z0-9_-]/g, char => `\\${char}`)
}

function escapeAttribute(value) {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

function normalizeText(value) {
  return value.replace(/\s+/g, ' ').trim().slice(0, 240)
}

function compactObject(value) {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined))
}
