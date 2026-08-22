<template>
  <BaseTile
    class="tags-tile"
    :interactive="canInteract"
    @click="canInteract && open($event)"
  >
    <BlockTagsView :sections="displaySections" :label="label" :editable="canInteract" />
  </BaseTile>

  <MorphEditorShell
    v-if="editorOpen"
    :origin-rect="originRect"
    :origin-el="originEl"
    :strip="false"
    :min-view-width="300"
    @close="close"
  >
    <template #view>
      <BlockTagsView :sections="displaySections" :label="label" panel />
    </template>
    <template #editor>
      <BlockTagsEditor
        :sections="sections"
        :custom-tags="!!block.content.custom_tags"
        @add-tag="addTag"
        @remove-tag="removeTag"
        @add-section="addSection"
        @remove-section="removeSection"
      />
    </template>
  </MorphEditorShell>
</template>

<script setup>
import { computed, inject, ref } from 'vue'
import { BaseTile } from '@sylvieshare/share-ui'
import BlockTagsEditor from '@/features/character-editor/blocks/generic/components/BlockTagsEditor'
import BlockTagsView from '@/features/character-editor/blocks/generic/components/BlockTagsView'
import MorphEditorShell from '@/features/character-editor/components/MorphEditorShell'
import { useMorphOrigin } from '@/features/character-editor/composables/useMorphOrigin'
import { useSuggestStore } from '@/stores/suggest'

const props = defineProps(['block', 'value'])
const emit = defineEmits(['update:value'])
const charCtx = inject('charCtx', { ownerMode: false })
const suggestStore = useSuggestStore()
const { editorOpen, originRect, originEl, open, close } = useMorphOrigin()

const label = computed(() => props.block.title || props.block.content?.title || 'Владения')
const canInteract = computed(() => charCtx.ownerMode)

const fixedSections = computed(() => props.block.content?.fixed_list ?? [])
const val = computed(() => props.value && !Array.isArray(props.value) ? props.value : {})
const fixedTitleSet = computed(() => new Set(fixedSections.value.map(s => s.title)))
const customTitles = computed(() => Object.keys(val.value).filter(t => !fixedTitleSet.value.has(t)))
const customSuggestId = computed(() => props.block.content?.custom_suggest_id)
const proficiencyKind = { 3: 'armor_proficiency', 4: 'weapon_proficiency', 5: 'tool_proficiency', 6: 'language_proficiency' }

for (const section of fixedSections.value) suggestStore.ensure(Number(section.suggest_id))

function grantedTags(section) {
  const kind = proficiencyKind[Number(section.suggest_id)]
  if (!kind) return []
  const rows = charCtx.characterDerivedEffects?.grantedProficiencies?.(kind) || []
  const dictionary = suggestStore.items(Number(section.suggest_id)) || []
  return rows.map((row) => dictionary.find((item) => String(item.id) === String(row.targetId))?.value).filter(Boolean)
}

const sections = computed(() => [
  ...fixedSections.value.map(s => ({ title: s.title, suggest_id: s.suggest_id, custom: false, tags: getTags(s.title) })),
  ...customTitles.value.map(t => ({ title: t, suggest_id: customSuggestId.value, custom: true, tags: getTags(t) })),
])
const displaySections = computed(() => sections.value.map((section) => {
  const fixed = fixedSections.value.find((row) => row.title === section.title)
  return fixed ? { ...section, tags: [...new Set([...section.tags, ...grantedTags(fixed)])] } : section
}))

function getTags(title) {
  return val.value[title] ?? []
}

function emitVal(v) {
  emit('update:value', props.block.id, v)
}

function addTag(title, v) {
  const cur = getTags(title)
  if (cur.includes(v)) return
  emitVal({ ...val.value, [title]: [...cur, v] })
}

function removeTag(title, i) {
  const cur = [...getTags(title)]
  cur.splice(i, 1)
  emitVal({ ...val.value, [title]: cur })
}

function addSection(title) {
  if (val.value[title]) return
  emitVal({ ...val.value, [title]: [] })
}

function removeSection(title) {
  const updated = { ...val.value }
  delete updated[title]
  emitVal(updated)
}
</script>

<style scoped>
.tags-tile {
  display: flex;
  width: 100%;
  box-sizing: border-box;
  min-width: 0;
}
</style>
