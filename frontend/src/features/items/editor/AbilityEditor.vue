<template>
  <div class="ability-editor">
    <div class="ability-editor-main">
      <div class="ability-editor-intro"><h3>Описание способности</h3><p>Название и правила, которые увидит игрок.</p></div>
      <slot />
      <AbilityRuleFields :fields="profile.primary.filter(field => !['level_source', 'level_class_id'].includes(field.key))" :data="data" @update:data="updateData" />
      <AbilityLevelSource :data="data" />
    </div>
    <div class="ability-editor-mechanics">
      <div class="ability-editor-intro"><h3>Механика и зависимости</h3><p>Добавьте только то, что даёт эта способность.</p></div>
      <BaseTile v-if="!entries.length" class="ability-empty"><Sparkles :size="24" /><p>Можно ограничиться описанием.</p><span>Заклинания, ресурсы и другие правила добавляются отдельными блоками.</span></BaseTile>
      <BaseTile v-for="card in entries" :key="card.id" class="ability-dependency">
        <RemoveButton icon="trash" class="ability-dependency-remove" :label="`Удалить блок «${cardTitle(card)}»`" :title="`Удалить блок «${cardTitle(card)}»`" @click="pendingRemove = card" />
        <details open>
          <summary :title="card.block.hint">{{ cardTitle(card) }}</summary>
          <AbilityActionEditor v-if="card.key === 'feature_actions'" :data="data[card.key][card.index]" :fields="card.block.fields[0].fields" />
          <AbilityResourceFields v-else-if="['resources', 'use_resources'].includes(card.key)" :fields="card.key === 'resources' ? card.block.fields : card.block.fields[0].fields" :data="card.key === 'resources' ? data : data[card.key][card.index]" :independent="card.key === 'use_resources'" />
          <AbilityChoiceEditor v-else-if="card.key === 'choices'" :fields="card.block.fields[0].fields" :data="data.choices[card.index]" />
          <AbilityChoiceDefenseEditor v-else-if="card.key === 'choice_defenses'" :fields="card.block.fields[0].fields" :data="data.choice_defenses[card.index]" />
          <AbilityPrerequisiteEditor v-else-if="card.key === 'prereq'" :fields="card.block.fields[0].fields" :data="data.prereq" />
          <AbilityDependencyEditor v-else-if="dependencyManifest[card.key]" :kind="card.key" :fields="card.block.fields[0].fields" :data="data[card.key][card.index]" />
          <AbilityProgressionEditor v-else-if="card.key === 'progression'" :data="data" />
          <AbilityWeaponDamageEditor v-else-if="card.key === 'weapon_damage'" :data="data[card.key][card.index]" :fields="card.block.fields[0].fields" />
          <AbilityStatusEffectEditor v-else-if="card.key === 'status_effects'" :data="data[card.key][card.index]" :fields="card.block.fields[0].fields" />
          <AbilityMechanicEditor v-else-if="['sheet_widgets', 'usage'].includes(card.key)" :kind="card.key" :data="card.index == null ? data[card.key] : data[card.key][card.index]" :fields="card.block.fields[0].fields" />
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
import { dependencyManifest } from './abilityDependencyManifest'
import AbilityDependencyEditor from './AbilityDependencyEditor.vue'
import AbilityChoiceEditor from './AbilityChoiceEditor.vue'
import AbilityChoiceDefenseEditor from './AbilityChoiceDefenseEditor.vue'
import AbilityPrerequisiteEditor from './AbilityPrerequisiteEditor.vue'
import { AppModalFrame, BaseTile, ConfirmDialog, FormTextInput, RemoveButton } from '@sylvieshare/share-ui'
import { Plus, Sparkles } from '@lucide/vue'
import AbilityLevelSource from './AbilityLevelSource.vue'
import AbilityProgressionEditor from './AbilityProgressionEditor.vue'
import AbilityWeaponDamageEditor from './AbilityWeaponDamageEditor.vue'
import AbilityStatusEffectEditor from './AbilityStatusEffectEditor.vue'
import AbilityMechanicEditor from './AbilityMechanicEditor.vue'
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
  const title = row?.title || row?.label || row?.text || card.block.fields[0].fields?.find(f => f.key === 'kind')?.options?.find(o => o.value === row?.kind)?.label
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
