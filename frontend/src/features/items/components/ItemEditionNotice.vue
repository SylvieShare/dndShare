<template>
  <div v-if="versions.length || !eligibility.eligible" class="edition-notice">
    <span v-if="versions.length">Правила: {{ versions.join(' · ') }}</span>
    <span v-if="!eligibility.eligible">{{ eligibility.reasons.join('. ') }}</span>
    <button v-if="decision?.replacedByItemId" type="button" class="ability-link" @click="replacementOpen = true">Посмотреть новую версию</button>
    <button v-if="item?.derivedFromItemId" type="button" class="ability-link" @click="originalOpen = true">Исходная версия</button>
    <ItemViewModal v-if="originalOpen" :item-id="item.derivedFromItemId" :z-index="zIndex" @close="originalOpen = false" />
    <ItemViewModal v-if="replacementOpen" :item-id="decision.replacedByItemId" :z-index="zIndex" @close="replacementOpen = false" />
  </div>
</template>
<script setup>
import { computed, defineAsyncComponent, inject, ref, unref } from 'vue'
import { useGameContextStore } from '@/stores/gameContext'
import { itemCompatibility, itemEditionEligibility } from '@/shared/lib/itemCompatibility'
const ItemViewModal = defineAsyncComponent(() => import('@/features/handbook/components/ItemViewModal.vue'))
const props = defineProps({ item: Object, zIndex: { type: Number, default: 5000 } })
const charCtx = inject('charCtx', null)
const game = useGameContextStore()
const createWizard = inject('createWizard', null)
const pickerEdition = inject('itemEditionId', null)
const editionId = computed(() => charCtx?.sourceVersionId ?? unref(pickerEdition) ?? unref(createWizard?.sourceVersionId) ?? game.sourceVersionId)
const decision = computed(() => itemCompatibility(props.item, editionId.value))
const eligibility = computed(() => itemEditionEligibility(props.item, editionId.value))
const versions = computed(() => (props.item?.compatibility || []).filter(row => ['native', 'compatible'].includes(row.status)).map(row => row.version).filter(Boolean))
const replacementOpen = ref(false)
const originalOpen = ref(false)
</script>
<style scoped>
.edition-notice { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-bottom: 12px; color: var(--text-muted); font-size: 12px; }
</style>
