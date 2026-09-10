<template>
  <DetailSection label="Развитие по уровням">
    <template #icon><TrendingUp /></template>
    <div class="progression-intro">
      <div>
        <strong>От первого шага до 20 уровня</strong>
        <p>Новые умения, усиления и выборы на каждом уровне класса. Нажмите на умение, чтобы прочитать его правила.</p>
      </div>
      <label v-if="!fixedSubclass && subclasses.length" class="progression-selector">
        <span>Показать путь подкласса</span>
        <FormSelect v-model:value="selectedId">
          <option value="">Только базовый класс</option>
          <option v-for="subclass in subclasses" :key="subclass.id" :value="String(subclass.id)">{{ subclass.name }}</option>
        </FormSelect>
      </label>
    </div>
    <p v-if="loading" class="progression-message" role="status">Загружаем классовые умения…</p>
    <div v-else-if="error" class="progression-message" role="alert">
      Не удалось загрузить развитие класса. <button type="button" @click="load">Повторить</button>
    </div>
    <template v-else>
      <p class="progression-note">Только изменения относительно предыдущего уровня класса: что получаете, что усиливается и что предстоит выбрать. Ячейки показаны для развития в одном классе; при мультиклассировании их общий запас рассчитывается отдельно.</p>
      <ol class="progression-track">
        <li v-for="row in roadmap" :key="row.level" class="progression-level" :class="{ 'progression-level--choice': row.choices.length }">
          <div class="progression-marker"><strong>{{ row.level }}</strong><span>уровень</span></div>
          <div class="progression-body">
            <div v-if="row.choices.length" class="progression-level-heading"><small>Есть выбор</small></div>
            <p v-if="row.hitPoints" class="progression-hp">{{ row.level === 1 ? 'Хиты на старте' : 'Прирост хитов' }}: {{ row.hitPoints }}</p>
            <div v-if="row.features.length" class="progression-features">
              <small class="progression-caption">Получаете способности</small>
              <button v-for="feature in row.features" :key="feature.id" type="button" class="progression-item" @click="$emit('open-item', feature)">
                <HandbookListItem :item="feature" :type="itemTypes.getType(4)" />
                <span v-for="gain in row.improvements.filter(gain => gain.item.id === feature.id)" :key="gain.text" class="progression-resource">{{ gain.text }}</span>
              </button>
            </div>
            <ul v-if="row.choices.length" class="progression-choices">
              <li v-for="(choice, index) in row.choices" :key="index">
                <GitBranch :size="14" aria-hidden="true" />
                <div><strong>{{ choice.text }} · {{ choice.count }}</strong><small v-if="choice.options">{{ choice.options }}</small></div>
              </li>
            </ul>
            <div v-for="(gain, index) in row.improvements.filter(gain => !row.features.some(feature => feature.id === gain.item.id))" :key="`gain-${index}`" class="progression-gain">
              <button type="button" class="progression-item" @click="$emit('open-item', gain.item)"><HandbookListItem :item="gain.item" :type="itemTypes.getType(4)" /></button><span>Усиление: {{ gain.text }}</span>
            </div>
            <p v-for="resource in row.resources" :key="resource" class="progression-resource">{{ resource }}</p>
            <div v-if="row.spells.length" class="progression-spells">
              <span>Дарованные заклинания</span>
              <div v-for="(spell, index) in row.spells" :key="index">
                <button type="button" class="progression-item" @click="$emit('open-item', spellById[spell.spellId] || { id: spell.spellId, typeId: 5 })">
                  <HandbookListItem :item="spellById[spell.spellId] || { id: spell.spellId, typeId: 5, name: `Заклинание #${spell.spellId}` }" :type="itemTypes.getType(5)" />
                </button>
                <small v-if="spell.option">При выборе: {{ spell.option }}</small>
              </div>
            </div>
            <div v-if="row.slotChanges.length" class="progression-magic">
              <div v-for="(slot, index) in row.slotChanges" :key="index" class="progression-slot">
                <div class="progression-slot-value" role="img" :aria-label="slot.kind === 'added' ? `Добавляется ${slot.count} яч. ${slot.level} круга` : `${slot.count} яч. усиливаются с ${slot.fromLevel} до ${slot.level} круга`">
                  <strong class="progression-slot-count" aria-hidden="true">{{ slot.kind === 'added' ? '+' : '' }}{{ slot.count }}</strong>
                  <div class="progression-slot-icon" aria-hidden="true">
                    <SpellSlotSphere :level="slot.level" :size="28" :interactive="false" />
                    <small>{{ slot.kind === 'upgraded' ? `${slot.fromLevel} → ` : '' }}{{ slot.level }} круг</small>
                  </div>
                </div>
                <small v-if="slot.pact" class="progression-slot-note">Магия договора · короткий отдых</small>
              </div>
            </div>
            <p v-if="!hasEvents(row)" class="progression-quiet">Других изменений в справочнике не указано.</p>
          </div>
        </li>
      </ol>
    </template>
  </DetailSection>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { GitBranch, TrendingUp } from '@lucide/vue'
import { FormSelect } from '@sylvieshare/share-ui'
import DetailSection from '@/shared/ui/DetailSection.vue'
import { itemsApi } from '@/shared/api/itemsApi'
import { classProgression } from '@/features/items/lib/classProgression'
import { loadClassProgressionAbilities } from '@/features/items/lib/loadClassProgressionAbilities'
import HandbookListItem from '@/features/items/list-components/HandbookListItem.vue'
import SpellSlotSphere from '@/features/items/components/SpellSlotSphere.vue'
import { useItemTypesStore } from '@/stores/itemTypes'

const props = defineProps({
  classItem: { type: Object, required: true },
  subclasses: { type: Array, default: () => [] },
  fixedSubclass: { type: Object, default: null },
})
defineEmits(['open-item'])
const selectedId = ref('')
const itemTypes = useItemTypesStore()
const abilities = ref([])
const spellById = ref({})
const loading = ref(false)
const error = ref(false)
let request = 0
const subclass = computed(() => props.fixedSubclass || props.subclasses.find(item => String(item.id) === selectedId.value))
const roadmap = computed(() => classProgression(props.classItem, subclass.value, abilities.value))

async function load() {
  const current = ++request
  loading.value = true
  error.value = false
  try {
    const [response] = await Promise.all([
      loadClassProgressionAbilities(props.classItem.id),
      itemTypes.ensureAll(),
    ])
    if (current !== request) return
    abilities.value = response.items || []
    const ids = [...new Set(roadmap.value.flatMap(row => row.spells.map(spell => spell.spellId)))]
    const spells = ids.length ? await itemsApi.byIds(ids) : { items: [] }
    if (current === request) spellById.value = Object.fromEntries(spells.items.map(item => [item.id, item]))
  } catch {
    if (current === request) error.value = true
  } finally {
    if (current === request) loading.value = false
  }
}
watch(() => props.classItem.id, () => { selectedId.value = '' })
watch([() => props.classItem, subclass], load, { immediate: true })
function hasEvents(row) { return row.features.length || row.choices.length || row.improvements.length || row.resources.length || row.spells.length || row.slotChanges.length }
</script>

<style scoped>
.progression-intro { display: flex; align-items: flex-start; justify-content: space-between; gap: 20px; padding: 8px 0 14px; }
.progression-intro strong { font: 600 20px var(--font-display); color: var(--text-1); }
.progression-intro p, .progression-note { color: var(--text-muted); font-size: 12px; line-height: 1.65; margin: 6px 0 0; }
.progression-selector { flex: 0 1 260px; min-width: 180px; display: grid; gap: 6px; }
.progression-selector > span { color: var(--text-2); font-size: 11px; }
.progression-note { padding-bottom: 18px; }
.progression-track { list-style: none; margin: 0; padding: 0; }
.progression-level { display: grid; grid-template-columns: 64px minmax(0, 1fr); gap: 16px; }
.progression-marker { position: relative; display: flex; flex-direction: column; align-items: center; padding-top: 14px; color: var(--text-muted); }
.progression-marker::after { content: ''; width: 1px; flex: 1; min-height: 18px; margin-top: 10px; background: var(--border); }
.progression-level:last-child .progression-marker::after { display: none; }
.progression-marker strong { font: 600 28px var(--font-display); color: var(--text-2); line-height: 1; }
.progression-marker span { margin-top: 5px; font-size: 9px; }
.progression-level--choice .progression-marker strong { color: var(--accent-soft); }
.progression-body { min-width: 0; padding: 15px 0 22px; border-top: 1px solid var(--border); }
.progression-level-heading { display: flex; justify-content: space-between; gap: 8px; color: var(--text-muted); font-size: 10px; margin-bottom: 10px; }
.progression-hp { margin: 0 0 12px; color: var(--text-muted); font-size: 11px; }
.progression-level-heading > small { color: var(--accent-soft); text-transform: uppercase; letter-spacing: .08em; font-weight: 700; }
.progression-features { display: grid; gap: 6px; }
.progression-caption { color: var(--text-muted); font-size: 10px; letter-spacing: .06em; text-transform: uppercase; }
.progression-item { width: 100%; min-width: 0; }
.progression-item:hover { background: color-mix(in srgb, var(--accent) 7%, transparent); }
.progression-body button, .progression-message button { padding: 0; background: none; border: none; color: var(--accent-soft); font-family: inherit; text-align: left; cursor: pointer; }
.progression-message button:hover { text-decoration: underline; }
.progression-choices { list-style: none; padding: 10px 12px; margin: 12px 0 0; border-left: 2px solid var(--accent); background: color-mix(in srgb, var(--accent) 7%, transparent); }
.progression-choices li { display: flex; gap: 8px; padding: 4px 0; color: var(--accent-soft); font-size: 12px; }
.progression-choices svg { flex: none; margin-top: 2px; }
.progression-choices strong { font-weight: 550; }
.progression-choices small { display: block; margin-top: 4px; color: var(--text-muted); font-size: 11px; line-height: 1.5; }
.progression-gain { display: grid; gap: 4px; font-size: 12px; margin-top: 9px; color: var(--text-2); }
.progression-gain button { font-size: inherit; }
.progression-resource, .progression-quiet { font-size: 12px; color: var(--text-muted); margin: 10px 0 0; }
.progression-spells { display: grid; gap: 6px; margin-top: 12px; font-size: 12px; }
.progression-spells > span { color: var(--text-muted); }
.progression-magic { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 12px; }
.progression-slot { display: flex; flex-direction: column; align-items: flex-start; gap: 6px; padding: 6px 12px 6px 0; color: var(--text-2); font-size: 12px; }
.progression-slot-value { display: flex; align-items: flex-start; gap: 8px; }
.progression-slot-count { line-height: 28px; font-size: 16px; }
.progression-slot-icon { display: flex; flex-direction: column; align-items: center; gap: 5px; }
.progression-slot-icon small, .progression-slot-note { color: var(--text-muted); font-size: 10px; }
.progression-message { padding: 18px 0; color: var(--text-muted); font-size: 13px; }
@media (max-width: 600px) { .progression-intro { flex-direction: column; gap: 12px; } .progression-selector { flex: auto; width: 100%; } .progression-level { grid-template-columns: 42px minmax(0, 1fr); gap: 10px; } }
</style>
