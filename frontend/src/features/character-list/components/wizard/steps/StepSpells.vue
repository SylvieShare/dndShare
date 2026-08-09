<template>
  <div class="step">
    <p v-if="grants.spellcasting?.note" class="hint" v-html="grants.spellcasting.note" />

    <div v-if="grantedSpellList.length" class="sec">
      <div class="sheet-section-title">Заклинания архетипа</div>
      <p class="hint">Всегда подготовлены и не учитываются в числе подготовленных.</p>
      <div class="granted">
        <span v-for="sp in grantedSpellList" :key="sp.id" class="granted-tag">{{ sp.name }}</span>
      </div>
    </div>

    <div class="search">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></svg>
      <input v-model="query" type="text" placeholder="Поиск заклинания…" />
    </div>

    <template v-for="sec in sections" :key="sec.kind">
      <div v-if="sec.pool.length && sec.limit" class="sec">
        <div class="sheet-section-title">
          {{ sec.title }}
          <span class="count" :class="{ done: sec.chosen === sec.limit }">{{ sec.chosen }} / {{ sec.limit }}</span>
        </div>
        <div class="list">
          <div
            v-for="sp in filtered(sec.pool)"
            :key="sp.id"
            class="spell"
            :class="{ on: state.spellIds.includes(sp.id), off: !state.spellIds.includes(sp.id) && sec.limit && sec.chosen >= sec.limit }"
            @click="toggleSpell(sp.id, sec.kind)"
          >
            <span class="box">
              <svg v-if="state.spellIds.includes(sp.id)" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5L20 6" /></svg>
            </span>
            <span class="sp-name">{{ sp.name }}</span>
            <span v-if="school(sp)" class="sp-school">{{ school(sp) }}</span>
            <button class="sp-view" title="Посмотреть заклинание" @click.stop="viewId = sp.id">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M1.5 12S5 5 12 5s10.5 7 10.5 7-3.5 7-10.5 7S1.5 12 1.5 12z" /><circle cx="12" cy="12" r="3" /></svg>
            </button>
          </div>
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
import ItemViewModal from '@/shared/ui/ItemViewModal'

const {
  state, grants, suggestValue,
  cantripPool, spell1Pool, cantripLimit, spell1Limit, cantripChosen, spell1Chosen, toggleSpell,
  grantedSpellList,
} = inject('createWizard')

const query = ref('')
const viewId = ref(null)

const sections = computed(() => [
  { kind: 'cantrip', title: 'Заговоры', pool: cantripPool.value, limit: cantripLimit.value, chosen: cantripChosen.value },
  { kind: 'spell', title: 'Заклинания 1 круга', pool: spell1Pool.value, limit: spell1Limit.value, chosen: spell1Chosen.value },
])

const preparesNote = computed(() => (
  grants.value.spellcasting?.prepares && spell1Limit.value === 0 && spell1Pool.value.length
    ? 'Заклинания 1 круга ты подготавливаешь из всего списка класса каждый день — выбирать их при создании не нужно.'
    : ''
))

function filtered(pool) {
  const q = query.value.trim().toLowerCase()
  return q ? pool.filter((sp) => String(sp.name).toLowerCase().includes(q)) : pool
}
function school(sp) { return suggestValue(7, sp.data?.schoolId) || '' }
</script>

<style scoped>
.step { display: flex; flex-direction: column; gap: 12px; }
.hint { font-size: 12px; color: var(--text-muted); margin: 0; }
.search { position: relative; display: flex; align-items: center; }
.search svg { position: absolute; left: 11px; width: 15px; height: 15px; color: var(--text-muted); pointer-events: none; }
.search input {
  width: 100%; box-sizing: border-box; background: var(--surface-raised); border: 1px solid var(--border-strong);
  border-radius: 9px; color: var(--text-1); font: inherit; font-size: 13px; padding: 8px 12px 8px 32px; outline: none;
}
.search input:focus { border-color: var(--accent); }
.sec { display: flex; flex-direction: column; gap: 8px; }
.granted { display: flex; flex-wrap: wrap; gap: 7px; }
.granted-tag {
  display: inline-flex; align-items: center;
  background: color-mix(in srgb, var(--accent) 13%, var(--surface));
  border-radius: 999px; color: var(--text-1); font-size: 12px; padding: 6px 13px;
}
.count { font-size: 12px; font-weight: 600; color: var(--text-muted); letter-spacing: 0; text-transform: none; }
.count.done { color: var(--success); }
.list { display: grid; grid-template-columns: repeat(auto-fill, minmax(210px, 1fr)); gap: 6px; }
.spell {
  display: flex; align-items: center; gap: 10px;
  background: var(--surface); border-radius: var(--r-md);
  padding: 9px 12px; cursor: pointer; transition: background 0.15s;
}
.spell:hover { background: color-mix(in srgb, var(--accent) 12%, var(--surface)); }
.spell.on { background: color-mix(in srgb, var(--accent) 16%, var(--surface)); }
.spell.off { opacity: 0.45; cursor: default; }
.spell.off:hover { background: var(--surface); }
.box { flex-shrink: 0; width: 18px; height: 18px; border-radius: 5px; background: var(--surface-raised); display: flex; align-items: center; justify-content: center; }
.spell.on .box { background: var(--accent); }
.box svg { width: 12px; height: 12px; color: var(--text-on-accent); }
.sp-name { flex: 1; font-size: 13px; color: var(--text-1); }
.sp-school { font-size: 10px; color: var(--text-muted); white-space: nowrap; }
.sp-view {
  flex-shrink: 0; display: flex; align-items: center; justify-content: center;
  width: 24px; height: 24px; border: none; border-radius: 6px;
  background: none; color: var(--text-muted); cursor: pointer; transition: background 0.15s, color 0.15s;
}
.sp-view:hover { background: color-mix(in srgb, var(--accent) 18%, transparent); color: var(--accent); }
.sp-view svg { width: 15px; height: 15px; }
</style>
