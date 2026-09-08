<template>
  <div class="ability-editor">
    <div class="ability-editor-main">
      <div class="ability-editor-intro"><h3>Описание способности</h3><p>Название и правила, которые увидит игрок.</p></div>
      <slot />
      <AbilityRuleFields :fields="profile.primary" :data="data" @update:data="updateData" />
    </div>
    <div class="ability-editor-mechanics">
      <div class="ability-editor-intro"><h3>Механика и зависимости</h3><p>Добавьте только то, что даёт эта способность.</p></div>
      <BaseTile v-if="!entries.length" class="ability-empty"><Sparkles :size="24" /><p>Можно ограничиться описанием.</p><span>Заклинания, ресурсы и другие правила добавляются отдельными блоками.</span></BaseTile>
      <BaseTile v-for="card in entries" :key="card.id" class="ability-dependency">
        <RemoveButton icon="trash" class="ability-dependency-remove" :label="`Удалить блок «${cardTitle(card)}»`" :title="`Удалить блок «${cardTitle(card)}»`" @click="pendingRemove = card" />
        <details open>
          <summary :title="card.block.hint">{{ cardTitle(card) }}</summary>
          <AbilityActionEditor v-if="card.key === 'feature_actions'" :data="data[card.key][card.index]" :fields="card.block.fields[0].fields" />
          <AbilityResourceFields v-else-if="card.key === 'resources'" :fields="card.block.fields" :data="data" />
          <AbilityRuleFields v-else :fields="card.block.repeatable ? card.block.fields[0].fields : card.block.fields" :data="card.index == null ? data : data[card.key][card.index]" :hide-label-for="card.index == null ? card.key : ''" :advanced="card.block.repeatable" @update:data="value => update(card, value)" />
        </details>
      </BaseTile>
      <button v-if="availableBlocks.length" type="button" class="ability-add-dependency" @click="adding = true"><Plus :size="16" /> Добавить зависимость</button>
    </div>
    <AppModalFrame v-if="adding" title="Добавить зависимость" :z-index="zIndex + 200" @close="adding = false">
      <FormTextInput v-model:value="search" aria-label="Найти тип зависимости" placeholder="Заклинания, ресурс, защита…" />
      <div class="ability-block-options">
        <BaseTile v-for="block in filteredBlocks" :key="block.key" interactive class="ability-block-option" role="button" tabindex="0" @click="add(block)" @keydown.enter="add(block)" @keydown.space.prevent="add(block)">
          <strong>{{ block.name }}</strong><span>{{ block.hint || 'Дополнительные правила способности.' }}</span>
        </BaseTile>
        <p v-if="!filteredBlocks.length">Подходящих блоков нет.</p>
      </div>
    </AppModalFrame>
    <ConfirmDialog v-if="pendingRemove" title="Убрать блок?" :message="`Настройки «${cardTitle(pendingRemove)}» будут удалены из этой формы. Изменение применится после сохранения способности.`" confirm-text="Убрать" :z-index="zIndex + 300" @confirm="remove" @close="pendingRemove = null" @cancel="pendingRemove = null" />
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { AppModalFrame, BaseTile, ConfirmDialog, FormTextInput, RemoveButton } from '@sylvieshare/share-ui'
import { Plus, Sparkles } from '@lucide/vue'
import AbilityActionEditor from './AbilityActionEditor.vue'
import { useAbilityDependencies } from './useAbilityDependencies'
import AbilityResourceFields from './AbilityResourceFields.vue'
import AbilityRuleFields from './AbilityRuleFields.vue'
import { abilityEditorProfile } from './abilityEditorProfile'

const props = defineProps({ fields: { type: Array, required: true }, data: { type: Object, required: true }, typeId: { type: Number, required: true }, zIndex: { type: Number, default: 4500 } })
const profile = computed(() => abilityEditorProfile(props.fields, props.typeId))
const { entries, available: availableBlocks, add: addDependency, remove: removeDependency, update } = useAbilityDependencies(profile, props.data)
function cardTitle(card) {
  const row = card.index == null ? null : props.data[card.key][card.index]
  const title = row?.title || row?.label
  return `${card.block.name}${title ? ` · ${title}` : card.index == null ? '' : ` · ${card.index + 1}`}`
}
const adding = ref(false)
const search = ref('')
const pendingRemove = ref(null)
const filteredBlocks = computed(() => availableBlocks.value.filter(block => `${block.name} ${block.hint || ''}`.toLocaleLowerCase('ru').includes(search.value.toLocaleLowerCase('ru'))))
function updateData(value) { Object.assign(props.data, value) }
function add(block) {
  addDependency(block)
  adding.value = false
  search.value = ''
}
function remove() {
  removeDependency(pendingRemove.value)
  pendingRemove.value = null
}
</script>

<style src="./abilityEditor.css"></style>
