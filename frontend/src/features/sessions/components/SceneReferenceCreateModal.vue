<template>
  <LocationEditorModal
    v-if="type === 'location'"
    :locations="sessionWorld?.locations.value || []"
    :saving="saving"
    :relation-items="relationItems"
    @close="$emit('close')"
    @save="save"
  />
  <NpcEditorModal
    v-else-if="type === 'npc'"
    :locations="sessionWorld?.locations.value || []"
    :locations-by-id="sessionWorld?.locationsById.value || new Map()"
    :npcs="sessionWorld?.npcs.value || []"
    :saving="saving"
    :relation-items="relationItems"
    @close="$emit('close')"
    @save="save"
  />
  <QuestEditorModal
    v-else-if="type === 'quest'"
    :saving="saving"
    :relation-items="relationItems"
    @close="$emit('close')"
    @save="save"
  />
  <MaterialEditorModal
    v-else-if="type === 'material'"
    :saving="saving"
    :relation-items="relationItems"
    @close="$emit('close')"
    @save="save"
  />
</template>

<script setup>
import { computed, inject, ref } from 'vue'
import LocationEditorModal from '@/features/sessions/components/LocationEditorModal.vue'
import MaterialEditorModal from '@/features/sessions/components/MaterialEditorModal.vue'
import NpcEditorModal from '@/features/sessions/components/NpcEditorModal.vue'
import QuestEditorModal from '@/features/sessions/components/QuestEditorModal.vue'
import { buildSessionEntityCatalog, sessionEntityKey } from '@/features/sessions/lib/sessionEntityRelations'

const props = defineProps({ type: { type: String, required: true } })
const emit = defineEmits(['close', 'saved', 'error'])
const sessionWorld = inject('sessionWorld', null)
const sessionMaterials = inject('sessionMaterials', null)
const materialSaving = ref(false)
const saving = computed(() => materialSaving.value || sessionWorld?.saving.value || false)
const relationItems = computed(() => buildSessionEntityCatalog(sessionWorld, sessionMaterials))

async function save(payload) {
  if (saving.value) return
  try {
    let id = null
    if (props.type === 'material') {
      materialSaving.value = true
      const material = await sessionMaterials?.create(payload)
      id = material?.id
      await sessionWorld?.load(true).catch(() => {})
    } else if (props.type === 'location') {
      id = await sessionWorld?.saveLocation(null, payload)
      await sessionMaterials?.load(true).catch(() => {})
    } else if (props.type === 'npc') {
      id = await sessionWorld?.saveNpc(null, payload)
      await sessionMaterials?.load(true).catch(() => {})
    } else if (props.type === 'quest') {
      id = await sessionWorld?.saveQuest(null, payload)
      await sessionMaterials?.load(true).catch(() => {})
    }
    const item = buildSessionEntityCatalog(sessionWorld, sessionMaterials)
      .find(candidate => candidate.key === sessionEntityKey(props.type, id))
    if (item) emit('saved', item)
    else emit('error')
  } catch {
    emit('error')
  } finally {
    materialSaving.value = false
  }
}
</script>
