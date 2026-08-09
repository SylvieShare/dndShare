/**
 * Pure helpers for resolving template layouts (blocks + layouts.desktop/mobile).
 * No reactive state — safe to use anywhere (composables, tests, template editor).
 */

export function profileTabs(profile) {
  return profile?.tabs || []
}

export function initialTabs(template) {
  const layouts = template?.layouts || {}
  const desktop = profileTabs(layouts.desktop)
  return desktop.length ? desktop : profileTabs(layouts.mobile)
}

export function activeLayoutProfile(template, isMobile) {
  const layouts = template?.layouts || {}
  if (isMobile && layouts.mobile) return layouts.mobile
  return layouts.desktop
}

export function resolveDataPath(path, data) {
  if (!path) return ''
  const root = { values: data?.values || {}, var: data?.var || {} }
  return String(path).split('.').reduce((obj, key) => obj?.[key], root)
}

export function formatLayoutTitlePart(value) {
  if (value == null || value === '') return ''
  if (typeof value === 'object') return value.name != null ? String(value.name) : ''
  return String(value)
}

export function resolveLayoutTitle(pathOrPaths, data) {
  const paths = Array.isArray(pathOrPaths) ? pathOrPaths : pathOrPaths ? [pathOrPaths] : []
  return paths
    .map(path => resolveDataPath(path, data))
    .map(formatLayoutTitlePart)
    .filter(Boolean)
    .join(' • ')
}

export function mergeBlockPlacement(block, props = {}) {
  const next = JSON.parse(JSON.stringify(block))
  if (!props || !Object.keys(props).length) return next
  next.props = { ...(next.props || {}), ...props }
  if (props.content) next.content = { ...(next.content || {}), ...props.content }
  return next
}

export function mergeNodeProps(node, props = {}) {
  if (!node || !props || !Object.keys(props).length) return node
  return { ...node, props: { ...(node.props || {}), ...props } }
}

const LAYOUT_KIND_MAP = { row: 'HORIZONTAL_LIST', column: 'VERTICAL_LIST', grid: 'TABLE', 'scroll-x': 'SCROLL_X' }

export function layoutNodeToBlock(node, template) {
  if (!node) return null
  if (node.kind === 'section') {
    const section = template?.sections?.[node.ref]
    return layoutNodeToBlock(mergeNodeProps(section, node.props), template)
  }
  if (node.kind === 'block') {
    const block = template?.blocks?.[node.ref]
    if (!block) return { type: 'SECTION_HEADER', title: `Не найден блок: ${node.ref}` }
    const reserved = ['kind', 'ref', 'props', 'children', 'type']
    const extraProps = {}
    for (const k of Object.keys(node)) {
      if (!reserved.includes(k)) extraProps[k] = node[k]
    }
    return mergeBlockPlacement(block, { ...(node.props || {}), ...extraProps })
  }
  if (node.kind === 'layout') {
    const layoutType = node.type || node.ref
    if (layoutType === 'inner_tabs') {
      return {
        type: 'INNER_TABS',
        props: { ...(node.props || {}) },
        content: { ...(node.props || {}) },
        tabs: (node.children || []).map(tab => ({
          title: tab.title,
          svg: tab.svg,
          block: layoutNodeToBlock(tab.content, template),
        })).filter(t => t.block),
      }
    }
    return {
      type: LAYOUT_KIND_MAP[layoutType] || layoutType,
      props: { ...(node.props || {}) },
      content: { ...(node.props || {}) },
      blocks: (node.children || []).map(child => layoutNodeToBlock(child, template)).filter(Boolean),
    }
  }
  if (node.type) return node
  return null
}
