<template>
  <div class="step">
    <p v-if="grants.spellcasting?.note" class="hint" v-html="grants.spellcasting.note" />

    <div v-if="grantedSpellList.length" class="sec">
      <div class="sheet-section-title">Заклинания архетипа</div>
      <p class="hint">Всегда подготовлены и не учитываются в числе подготовленных.</p>
      <div class="granted list">
        <SpellSelectTile
          v-for="sp in grantedSpellList"
          :key="sp.id"
          :spell="sp"
          :school="schoolName(sp)"
          selected
          readonly
          @details="viewId = sp.id"
        />
      </div>
    </div>

    <template v-for="sec in sections" :key="sec.kind">
      <div v-if="sec.pool.length && sec.limit" class="sec">
        <div class="sheet-section-title">
          {{ sec.title }}
          <span class="count" :class="{ done: sec.chosen === sec.limit }">{{ sec.chosen }} / {{ sec.limit }}</span>
        </div>
        <div class="list">
          <SpellSelectTile
            v-for="sp in sec.pool"
            :key="sp.id"
            :spell="sp"
            :school="schoolName(sp)"
            :selected="state.spellIds.includes(sp.id)"
            :disabled="!state.spellIds.includes(sp.id) && !!sec.limit && sec.chosen >= sec.limit"
            @select="toggleSpell(sp.id, sec.kind)"
            @details="viewId = sp.id"
          />
        </div>
      </div>
    </template>

    <p v-if="preparesNote" class="hint">{{ preparesNote }}</p>
    <p v-if="!cantripPool.length && !spell1Pool.length" class="hint">Доступных заклинаний для класса не найдено.</p>

    <ItemViewModal
      v-if="viewId != null"
      :item-type-id="5"
      :item-id="viewId"
      @close="viewId = null"
    />
  </div>
</template>

<script setup>
import { computed, inject, ref } from 'vue'
import ItemViewModal from '@/features/handbook/components/ItemViewModal.vue'
import SpellSelectTile from '@/features/character-list/components/wizard/SpellSelectTile.vue'
import { useSuggestStore } from '@/stores/suggest'

const {
  state, grants,
  cantripPool, spell1Pool, cantripLimit, spell1Limit, cantripChosen, spell1Chosen, toggleSpell,
  grantedSpellList,
} = inject('createWizard')

const viewId = ref(null)
const suggestStore = useSuggestStore()
suggestStore.ensure(7)
const schoolMap = computed(() => new Map(suggestStore.items(7).map((entry) => [String(entry.id), entry.value])))

const sections = computed(() => [
  { kind: 'cantrip', title: 'Заговоры', pool: cantripPool.value, limit: cantripLimit.value, chosen: cantripChosen.value },
  { kind: 'spell', title: 'Заклинания 1 круга', pool: spell1Pool.value, limit: spell1Limit.value, chosen: spell1Chosen.value },
])

const preparesNote = computed(() => (
  grants.value.spellcasting?.prepares && spell1Limit.value === 0 && spell1Pool.value.length
    ? 'Заклинания 1 круга ты подготавливаешь из всего списка класса каждый день — выбирать их при создании не нужно.'
    : ''
))

function schoolName(spell) { return schoolMap.value.get(String(spell?.data?.schoolId)) || '' }
</script>

<style scoped>
.step { display: flex; flex-direction: column; gap: 12px; }
.hint { font-size: 12px; color: var(--text-muted); margin: 0; }
.sec { display: flex; flex-direction: column; gap: 8px; }
.granted { margin-top: 1px; }
.count { font-size: 12px; font-weight: 600; color: var(--text-muted); letter-spacing: 0; text-transform: none; }
.count.done { color: var(--success); }
.list { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 7px; }
@media (max-width: 900px) { .list { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 560px) { .list { grid-template-columns: 1fr; } }
</style>
