<template>
  <div class="ability-editor catalogue-editor">
    <div class="ability-editor-main">
      <div class="ability-editor-intro"><h3>{{ profile.title }}</h3><p>Описание и оформление записи.</p></div>
      <slot />
      <CatalogueFields :fields="profile.primary" :data="data" :type-id="typeId" :root-data="data" @update:data="update" />
    </div>
    <div class="ability-editor-mechanics">
      <div class="ability-editor-intro"><h3>Правила и свойства</h3><p>Настройки, которые используются в игре.</p></div>
      <BaseTile v-for="group in visibleGroups" :key="group.key" class="ability-dependency">
        <RemoveButton v-if="group.optional" icon="trash" class="ability-dependency-remove" :label="`Удалить раздел «${group.name}»`" @click="pending = group" />
        <details open>
          <summary>{{ group.name }}</summary>
          <CatalogueFields :fields="group.fields" :data="data" :type-id="typeId" :root-data="data" :hide-label-for="group.fields.length === 1 ? group.fields[0].key : ''" @update:data="update" />
        </details>
      </BaseTile>
      <AddButton v-if="available.length" label="Добавить настройки" @click="adding = true" />
    </div>
    <AppModalFrame v-if="adding" title="Добавить настройки" :z-index="zIndex + 200" @close="adding = false">
      <div class="ability-block-options">
        <BaseTile v-for="group in available" :key="group.key" class="ability-block-option" interactive role="button" tabindex="0" @click="add(group)" @keydown.enter="add(group)" @keydown.space.prevent="add(group)">
          <strong>{{ group.name }}</strong><span>{{ group.fields.map(f => f.name).join(' · ') }}</span>
        </BaseTile>
      </div>
    </AppModalFrame>
    <ConfirmDialog v-if="pending" title="Удалить настройки?" :message="`Раздел «${pending.name}» будет удалён после сохранения объекта.`" :z-index="zIndex + 300" @confirm="remove" @cancel="pending = null" @close="pending = null" />
  </div>
</template>
<script setup>
import { computed, inject, onScopeDispose, ref, watchEffect } from 'vue'
import { AddButton, AppModalFrame, BaseTile, ConfirmDialog, RemoveButton } from '@sylvieshare/share-ui'
import { catalogueProfile } from './catalogueProfiles'
import { hasFieldValue } from '../abilityEditorProfile'
import { defaultDataForFields } from '@/features/handbook/objects/lib/schemaFields'
import { catalogueFieldVisible } from './catalogueFields'
import CatalogueFields from './CatalogueFields.vue'
import { itemFieldEditorKey } from '@/features/character-editor/components/useItemFieldEditor'
import { catalogueValidation } from './catalogueValidation'
const props = defineProps({ typeId: Number, fields: Array, data: Object, zIndex: Number })
const editor = inject(itemFieldEditorKey, {}), validationKey = Symbol('catalogue')
watchEffect(() => editor.setValidationError?.(validationKey, catalogueValidation(props.fields, props.data, props.typeId).slice(0, 3).join(' ')))
onScopeDispose(() => editor.setValidationError?.(validationKey, ''))
const profile = computed(() => catalogueProfile(props.typeId, props.fields))
const enabled = ref(new Set(profile.value.groups.filter(g => g.fields.some(f => hasFieldValue(props.data[f.key]))).map(g => g.key)))
const visible = group => group.fields.some(field => catalogueFieldVisible(field, props.data, props.typeId, field.key, props.data))
const visibleGroups = computed(() => profile.value.groups.filter(g => (!g.optional || enabled.value.has(g.key)) && visible(g)))
const available = computed(() => profile.value.groups.filter(g => g.optional && !enabled.value.has(g.key) && visible(g)))
const adding = ref(false), pending = ref(null)
function update(value) { for (const key of Object.keys(props.data)) if (!(key in value)) delete props.data[key]; Object.assign(props.data, value) }
function add(group) {
  enabled.value.add(group.key)
  for (const field of group.fields) {
    if (field.type === 'object') props.data[field.key] = defaultDataForFields(field.fields)
    else if (['object_array', 'blocks'].includes(field.type)) props.data[field.key] = group.fields.length === 1 ? [defaultDataForFields(field.fields)] : []
    else if (field.default !== undefined) props.data[field.key] = field.default
  }
  adding.value = false
}
function remove() { for (const field of pending.value.fields) delete props.data[field.key]; enabled.value.delete(pending.value.key); pending.value = null }
</script>
<style src="./catalogueEditor.css"></style>
