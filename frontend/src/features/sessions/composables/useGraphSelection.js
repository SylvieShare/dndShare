import { computed, ref, toValue, watch } from 'vue'

export function graphNodeKey(nodeOrId) {
  return String(typeof nodeOrId === 'object' ? nodeOrId?.id : nodeOrId)
}

export function useGraphSelection(nodes, onChange) {
  const selectedKeys = ref(new Set())
  const selectedNodes = computed(() => toValue(nodes).filter(isSelected))

  function isSelected(node) {
    return selectedKeys.value.has(graphNodeKey(node))
  }

  function updateSelection(keys) {
    const next = new Set(keys)
    const current = selectedKeys.value
    if (next.size === current.size && [...next].every(key => current.has(key))) return
    selectedKeys.value = next
    onChange(selectedNodes.value.map(node => node.id))
  }

  function toggleSelection(node) {
    const next = new Set(selectedKeys.value)
    const key = graphNodeKey(node)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    updateSelection(next)
  }

  function clearSelection() {
    updateSelection([])
  }

  watch(() => toValue(nodes).map(graphNodeKey).join('|'), () => {
    const available = new Set(toValue(nodes).map(graphNodeKey))
    updateSelection([...selectedKeys.value].filter(key => available.has(key)))
  })

  return { selectedNodes, isSelected, toggleSelection, clearSelection }
}
