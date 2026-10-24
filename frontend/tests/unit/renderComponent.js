import { createSSRApp, h } from 'vue'
import { renderToString } from 'vue/server-renderer'

// Every render receives a fresh app; stores and injections stay test-local.
export function renderComponent(component, props = {}, { slots, plugins = [], provide = [] } = {}) {
  const app = createSSRApp({ render: () => h(component, props, slots) })
  for (const plugin of plugins) app.use(plugin)
  for (const [key, value] of provide) app.provide(key, value)
  return renderToString(app)
}
