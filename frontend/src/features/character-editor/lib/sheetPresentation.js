export function sheetTabs(definition, format = 'desktop') {
  return definition?.tabs?.[format] || []
}

export function sheetTabIndex(tabs, id) {
  const index = tabs.findIndex(tab => tab.id === id)
  return index < 0 ? 0 : index
}

export function sheetBlock(definition, id, options = {}) {
  const block = definition?.blocks?.[id]
  return block ? { ...block, props: { ...block.props, ...options } } : null
}
