export function useSessionGraphEdgeActions({ sceneGraph, blockGraph, edgeMenus, saving, actionError, displayLevel, emit, beginNestedEdgeEdit, pendingDelete, sceneLinkingFrom, blockLinkingFrom, createNestedEdge }) {
function startLink(node) {
  if (displayLevel.value === 'chapters') return emit('start-link', node)
  const target = displayLevel.value === 'scenes' ? sceneLinkingFrom : blockLinkingFrom
  target.value = node?.id === target.value?.id ? null : node
}

async function finishLink(node) {
  if (displayLevel.value === 'chapters') return emit('finish-link', node)
  const target = displayLevel.value === 'scenes' ? sceneLinkingFrom : blockLinkingFrom
  if (!target.value || target.value.id === node.id) return
  const from = target.value
  target.value = null
  await createNestedEdge(displayLevel.value, from, node)
}

async function updateNestedEdge(level, edge, patch, fallback) {
  const graph = level === 'scenes' ? sceneGraph : blockGraph
  edgeMenus.value?.close()
  saving.value = true
  actionError.value = ''
  try {
    await graph.updateEdge(edge.id, patch)
  } catch {
    actionError.value = fallback
  } finally {
    saving.value = false
  }
}

function toggleNestedEdgeDirection(edge, level) {
  return updateNestedEdge(level, edge, { bidirectional: !edge.bidirectional }, 'Не удалось изменить направление перехода')
}

function reverseNestedEdge(edge, level) {
  const patch = level === 'scenes'
    ? { fromSceneId: edge.toSceneId, toSceneId: edge.fromSceneId }
    : { fromItemId: edge.toItemId, toItemId: edge.fromItemId }
  return updateNestedEdge(level, edge, patch, 'Не удалось поменять направление перехода')
}

function rewireEdge(edge, from, to) {
  if (displayLevel.value === 'chapters') return emit('rewire-edge', edge, from, to)
  const patch = displayLevel.value === 'scenes'
    ? { fromSceneId: from.id, toSceneId: to.id }
    : { fromItemId: from.id, toItemId: to.id }
  return updateNestedEdge(displayLevel.value, edge, patch, 'Не удалось переставить конец перехода')
}

function openNestedEdgeEdit(edge, level) {
  edgeMenus.value?.close()
  beginNestedEdgeEdit(level, edge)
}

function requestNestedEdgeDelete(edge, level) {
  edgeMenus.value?.close()
  pendingDelete.value = { kind: 'edge', edge, level }
}

return { startLink, finishLink, toggleNestedEdgeDirection, reverseNestedEdge, rewireEdge, openNestedEdgeEdit, requestNestedEdgeDelete }
}
