const DEFAULT_LIMIT = 100
const MAX_DETAIL_LENGTH = 30_000

export function formatConsoleValue(value) {
  if (value instanceof Error) return value.stack || `${value.name}: ${value.message}`
  if (isElement(value)) return describeElement(value)
  if (typeof value === 'string') return value
  if (typeof value === 'bigint') return `${value}n`
  if (typeof value === 'function') return `[Function ${value.name || 'anonymous'}]`
  if (typeof value === 'symbol') return value.toString()
  if (value === undefined) return 'undefined'

  try {
    const seen = new WeakSet()
    return JSON.stringify(value, (_key, item) => {
      if (item instanceof Error) {
        return { name: item.name, message: item.message, stack: item.stack }
      }
      if (typeof item === 'bigint') return `${item}n`
      if (typeof item === 'function') return `[Function ${item.name || 'anonymous'}]`
      if (typeof item === 'symbol') return item.toString()
      if (isElement(item)) return describeElement(item)
      if (item && typeof item === 'object') {
        if (seen.has(item)) return '[Circular]'
        seen.add(item)
      }
      return item
    }, 2)
  } catch {
    return String(value)
  }
}

export function formatConsoleArguments(args) {
  return args.map(formatConsoleValue).join('\n')
}

export function createConsoleErrorCollector(limit = DEFAULT_LIMIT) {
  let nextId = 1
  let entries = []
  const listeners = new Set()

  function snapshot() {
    return {
      entries: entries.map(entry => ({ ...entry })),
      totalCount: entries.reduce((total, entry) => total + entry.count, 0),
    }
  }

  function notify() {
    const next = snapshot()
    listeners.forEach(listener => {
      try {
        listener(next)
      } catch {
        // A diagnostics subscriber must not break application code that logged the error.
      }
    })
  }

  function record(input) {
    const now = input.createdAt || Date.now()
    const detail = trimDetail(input.detail || input.message || 'Неизвестная ошибка')
    const message = firstMeaningfulLine(input.message || detail)
    const fingerprint = [input.source, message, detail, input.pageUrl].join('\u0000')
    const existingIndex = entries.findIndex(entry => entry.fingerprint === fingerprint)

    if (existingIndex >= 0) {
      const existing = entries[existingIndex]
      entries.splice(existingIndex, 1)
      entries.unshift({ ...existing, count: existing.count + 1, updatedAt: now })
    } else {
      entries.unshift({
        id: nextId++,
        fingerprint,
        source: input.source || 'JavaScript',
        message,
        detail,
        pageUrl: input.pageUrl || '',
        createdAt: now,
        updatedAt: now,
        count: 1,
      })
      entries = entries.slice(0, Math.max(1, limit))
    }

    notify()
  }

  function subscribe(listener) {
    listeners.add(listener)
    listener(snapshot())
    return () => listeners.delete(listener)
  }

  return { record, snapshot, subscribe }
}

const collector = createConsoleErrorCollector()
let installed = false

export function installConsoleErrorCapture() {
  if (installed || typeof window === 'undefined') return
  installed = true

  const originalConsoleError = console.error.bind(console)
  console.error = (...args) => {
    try {
      const detail = formatConsoleArguments(args)
      collector.record({
        source: 'console.error',
        message: firstMeaningfulLine(detail),
        detail,
        pageUrl: window.location.href,
      })
    } catch {
      // Diagnostics must never interfere with the original console call.
    }
    originalConsoleError(...args)
  }

  window.addEventListener('error', event => {
    const location = event.filename
      ? `${event.filename}:${event.lineno || 0}:${event.colno || 0}`
      : ''
    const stack = event.error instanceof Error ? event.error.stack : ''
    collector.record({
      source: 'window.error',
      message: event.message || 'Необработанная ошибка JavaScript',
      detail: [event.message, location, stack].filter(Boolean).join('\n'),
      pageUrl: window.location.href,
    })
  })

  window.addEventListener('unhandledrejection', event => {
    const detail = formatConsoleValue(event.reason)
    collector.record({
      source: 'unhandledrejection',
      message: event.reason instanceof Error ? event.reason.message : firstMeaningfulLine(detail),
      detail,
      pageUrl: window.location.href,
    })
  })
}

export function subscribeConsoleErrors(listener) {
  return collector.subscribe(listener)
}

function firstMeaningfulLine(value) {
  return String(value || 'Неизвестная ошибка')
    .split('\n')
    .map(line => line.trim())
    .find(Boolean)
    ?.slice(0, 240) || 'Неизвестная ошибка'
}

function trimDetail(value) {
  const text = String(value)
  if (text.length <= MAX_DETAIL_LENGTH) return text
  return `${text.slice(0, MAX_DETAIL_LENGTH)}\n… текст ошибки обрезан`
}

function describeElement(element) {
  const id = element.id ? `#${element.id}` : ''
  const classes = [...element.classList].slice(0, 4).map(name => `.${name}`).join('')
  return `<${element.tagName.toLowerCase()}${id}${classes}>`
}

function isElement(value) {
  return typeof Element !== 'undefined' && value instanceof Element
}
