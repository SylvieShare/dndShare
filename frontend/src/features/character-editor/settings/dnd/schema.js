/**
 * D&D 5e sheet schema — hardcoded in code, no longer stored as JSON in the DB.
 *
 * Split across three data files (assembled here):
 *   - blocks.json   — id-keyed block definitions (shared by both profiles);
 *   - desktop.json  — desktop layout profile (tabs База / Личность / Заметки);
 *   - mobile.json   — mobile layout profile (6 tabs + toolbar/common strips).
 *
 * On top of the layout data this applies a code-driven restyle:
 *   - strip container "backdrop" backgrounds (layout panels go transparent);
 *   - strip container separator borders (no dividers between list-containers);
 *   - widen every gap.
 *
 * This is the per-setting styling contract — tweak the transform, not 40 inline
 * JSON style blocks.
 */
import blocks from './blocks.json'
import desktop from './desktop.json'
import mobile from './mobile.json'

const GAP_SCALE = 1.4

function scaleGap(gap) {
  if (typeof gap !== 'string') return gap
  const match = gap.match(/^(\d+(?:\.\d+)?)px$/)
  if (!match) return gap
  return `${Math.round(Number(match[1]) * GAP_SCALE)}px`
}

// Restyle a single layout/block node in place.
function restyleNode(node) {
  if (!node || typeof node !== 'object') return

  if (node.props && typeof node.props === 'object') {
    if (node.props.style && typeof node.props.style === 'object') {
      const style = node.props.style
      delete style.background
      // Drop container separator borders (border-right/bottom/left/top, border).
      for (const key of Object.keys(style)) {
        if (/^border/i.test(key)) delete style[key]
      }
    }
    if (node.props.gap != null) node.props.gap = scaleGap(node.props.gap)
  }

  if (Array.isArray(node.children)) node.children.forEach(restyleNode)
  if (node.content && typeof node.content === 'object') restyleNode(node.content)
}

function restyleProfile(profile) {
  for (const tab of profile.tabs || []) restyleNode(tab.content)
  if (profile.common_mobile_blocks) restyleNode(profile.common_mobile_blocks)
  return profile
}

function buildSchema() {
  const clone = obj => JSON.parse(JSON.stringify(obj))
  return {
    system: 'dnd5e',
    blocks: clone(blocks),
    layouts: {
      desktop: restyleProfile(clone(desktop)),
      mobile: restyleProfile(clone(mobile)),
    },
  }
}

export default buildSchema()
