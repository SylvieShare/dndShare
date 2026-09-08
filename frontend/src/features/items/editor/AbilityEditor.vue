<template>
  <div class="ability-editor">
    <div class="ability-editor-main">
      <div class="ability-editor-intro"><h3>Описание способности</h3><p>Название и правила, которые увидит игрок.</p></div>
      <slot />
      <AbilityRuleFields :fields="profile.primary" :data="data" @update:data="updateData" />
    </div>
    <div class="ability-editor-mechanics">
      <div class="ability-editor-intro"><h3>Механика и зависимости</h3><p>Добавьте только то, что даёт эта способность.</p></div>
      <BaseTile v-if="!activeBlocks.length" class="ability-empty"><Sparkles :size="24" /><p>Можно ограничиться описанием.</p><span>Заклинания, ресурсы и другие правила добавляются отдельными блоками.</span></BaseTile>
      <BaseTile v-for="block in activeBlocks" :key="block.key" class="ability-dependency">
        <RemoveButton icon="trash" class="ability-dependency-remove" :label="`Удалить блок «${block.name}»`" :title="`Удалить блок «${block.name}»`" @click="pendingRemove = block" />
        <details open>
          <summary :title="block.hint">{{ block.name }}</summary>
          <AbilityResourceFields v-if="block.key === 'resources'" :fields="block.fields" :data="data" />
          <AbilityRuleFields v-else :fields="block.fields" :data="data" :hide-label-for="block.key" @update:data="updateData" />
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
    <ConfirmDialog v-if="pendingRemove" title="Убрать блок?" :message="`Настройки «${pendingRemove.name}» будут удалены из этой формы. Изменение применится после сохранения способности.`" confirm-text="Убрать" :z-index="zIndex + 300" @confirm="remove" @close="pendingRemove = null" @cancel="pendingRemove = null" />
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { AppModalFrame, BaseTile, ConfirmDialog, FormTextInput, RemoveButton } from '@sylvieshare/share-ui'
import { Plus, Sparkles } from '@lucide/vue'
import AbilityResourceFields from './AbilityResourceFields.vue'
import AbilityRuleFields from './AbilityRuleFields.vue'
import { abilityEditorProfile, activeAbilityBlocks, addAbilityBlock, removeAbilityBlock } from './abilityEditorProfile'

const props = defineProps({ fields: { type: Array, required: true }, data: { type: Object, required: true }, typeId: { type: Number, required: true }, zIndex: { type: Number, default: 4500 } })
const profile = computed(() => abilityEditorProfile(props.fields, props.typeId))
const enabled = ref(activeAbilityBlocks(profile.value.blocks, props.data))
const activeBlocks = computed(() => profile.value.blocks.filter(block => enabled.value.includes(block.key)))
const availableBlocks = computed(() => profile.value.blocks.filter(block => !enabled.value.includes(block.key)))
const adding = ref(false)
const search = ref('')
const pendingRemove = ref(null)
const filteredBlocks = computed(() => availableBlocks.value.filter(block => `${block.name} ${block.hint || ''}`.toLocaleLowerCase('ru').includes(search.value.toLocaleLowerCase('ru'))))
function updateData(value) { Object.assign(props.data, value) }
function add(block) {
  addAbilityBlock(block, props.data)
  enabled.value.push(block.key)
  adding.value = false
  search.value = ''
}
function remove() {
  removeAbilityBlock(pendingRemove.value, props.data)
  enabled.value = enabled.value.filter(key => key !== pendingRemove.value.key)
  pendingRemove.value = null
}
</script>

<style src="./abilityEditor.css"></style>
