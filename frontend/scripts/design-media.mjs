import { designMediaQueries } from '../src/app/design-tokens.js'

export function expandDesignQuery(params) {
  return params.replace(/\(--ui-[a-z-]+\)/g, condition => {
    const key = condition.slice(1, -1)
    if (!Object.hasOwn(designMediaQueries, key)) throw new Error(`Unknown design query: ${key}`)
    return designMediaQueries[key]
  })
}

// Product media/container aliases are resolved before browser CSS is emitted.
export function designMedia() {
  return {
    postcssPlugin: 'dndshare-design-media',
    AtRule(rule) {
      if (rule.name === 'media' || rule.name === 'container') rule.params = expandDesignQuery(rule.params)
    },
  }
}
