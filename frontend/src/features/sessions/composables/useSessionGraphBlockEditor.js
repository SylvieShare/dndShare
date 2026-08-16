import { ref } from 'vue'
import { sceneBlockDefaultWidth } from '@/features/sessions/lib/sceneBlockTypes'

const referenceBlockTypes = new Set(['location', 'npc', 'quest', 'material'])
export const scenarioUsageBlockTypes = new Set(['location', 'npc', 'quest', 'material', 'image'])

export function useSessionGraphBlockEditor({
  props,
  emit,
  canvas,
  blockMenus,
  actionError,
  saving,
  sessionMaterials,
  sessionWorld,
  sessionPresentation,
  activeNodeHeight,
  activeNodeWidth,
  blockGraph,
  activeChapter,
  combatSceneContext,
}) {
  const blockEditorOpen = ref(false)
  const editingBlock = ref(null)
  const creatingBlockType = ref('text')
  const blockCreatePosition = ref({ x: 48, y: 210 })
  const referencePickerOpen = ref(false)
  const referenceCreateOpen = ref(false)

  async function refreshScenarioUsages() {
    await Promise.allSettled([
      sessionWorld?.load(true),
      sessionMaterials?.load(true),
    ].filter(Boolean))
  }

  function openBlockCreate(type) {
    editingBlock.value = null
    creatingBlockType.value = type
    blockCreatePosition.value = canvas.value?.viewportCenter(sceneBlockDefaultWidth(type), activeNodeHeight.value) ?? { x: 48, y: 210 }
    if (referenceBlockTypes.has(type)) {
      referencePickerOpen.value = true
      return
    }
    blockEditorOpen.value = true
  }

  function closeReferencePicker() { referencePickerOpen.value = false }

  function openReferenceCreate() {
    referencePickerOpen.value = false
    referenceCreateOpen.value = true
  }

  async function createReferenceBlock(item) {
    if (!item || item.type !== creatingBlockType.value || saving.value) return
    saving.value = true
    actionError.value = ''
    try {
      const material = item.type === 'material'
      await blockGraph.createItem({
        type: item.type,
        title: item.title,
        width: sceneBlockDefaultWidth(item.type),
        materialId: material ? Number(item.id) : null,
        data: material ? {} : { referenceId: Number(item.id) },
      }, blockCreatePosition.value)
      await refreshScenarioUsages()
      referencePickerOpen.value = false
      referenceCreateOpen.value = false
    } catch {
      actionError.value = 'Не удалось добавить объект на холст'
    } finally {
      saving.value = false
    }
  }

  function openBlockEdit(block) {
    if (!props.isDm) return
    blockMenus.value?.close()
    editingBlock.value = block
    creatingBlockType.value = block.type
    blockEditorOpen.value = true
  }

  async function copyBlock(block) {
    actionError.value = ''
    try {
      const data = block.data == null ? null : JSON.parse(JSON.stringify(block.data))
      await blockGraph.createItem({
        type: block.type,
        title: `${block.title || 'Без названия'} · копия`,
        data,
        width: block.width || activeNodeWidth.value,
        materialId: block.materialId || null,
      }, { x: block.positionX + 32, y: block.positionY + 32 })
      if (scenarioUsageBlockTypes.has(block.type)) await refreshScenarioUsages()
    } catch {
      actionError.value = 'Не удалось скопировать блок'
    }
  }

  function broadcastBlock(block) {
    blockMenus.value?.close()
    const material = sessionMaterials?.byId(block.materialId)
    if (material) sessionPresentation?.showMaterial(material).catch(() => { actionError.value = 'Не удалось запустить показ' })
  }

  function sendBlockToCombat(block) {
    blockMenus.value?.close()
    emit('send-block-to-combat', {
      block,
      chapter: activeChapter.value,
      scene: combatSceneContext(),
      level: 'blocks',
    })
  }

  function closeBlockEditor() {
    blockEditorOpen.value = false
    editingBlock.value = null
  }

  async function saveBlock(payload) {
    saving.value = true
    actionError.value = ''
    try {
      if (editingBlock.value) await blockGraph.updateItem(editingBlock.value.id, payload)
      else await blockGraph.createItem(payload, blockCreatePosition.value)
      if (scenarioUsageBlockTypes.has(payload.type || editingBlock.value?.type)) await refreshScenarioUsages()
      closeBlockEditor()
    } catch {
      actionError.value = 'Не удалось сохранить блок'
    } finally {
      saving.value = false
    }
  }

  return {
    blockEditorOpen,
    editingBlock,
    creatingBlockType,
    referencePickerOpen,
    referenceCreateOpen,
    openBlockCreate,
    closeReferencePicker,
    openReferenceCreate,
    createReferenceBlock,
    openBlockEdit,
    copyBlock,
    broadcastBlock,
    sendBlockToCombat,
    closeBlockEditor,
    saveBlock,
    refreshScenarioUsages,
  }
}
