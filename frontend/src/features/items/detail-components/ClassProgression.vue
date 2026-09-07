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
      <p class="progression-note">Уровни относятся к этому классу, не к суммарному уровню мультикласса. Ячейки и известные заклинания указаны всего на уровне; выборы и усиления — новые.</p>
      <ol class="progression-track">
        <li v-for="row in roadmap" :key="row.level" class="progression-level" :class="{ 'progression-level--choice': row.choices.length }">
          <div class="progression-marker"><strong>{{ row.level }}</strong><span>уровень</span></div>
          <div class="progression-body">
            <div class="progression-level-heading"><span>Бонус мастерства <b>+{{ row.proficiency }}</b></span><small v-if="row.choices.length">Есть выбор</small></div>
            <p v-if="row.hitPoints" class="progression-hp">{{ row.level === 1 ? 'Хиты на старте' : 'Прирост хитов' }}: {{ row.hitPoints }}</p>
            <div v-if="row.features.length" class="progression-features">
              <button v-for="feature in row.features" :key="feature.id" type="button" @click="$emit('open-item', feature)">{{ feature.name }} <ArrowUpRight :size="13" /></button>
            </div>
            <ul v-if="row.choices.length" class="progression-choices">
              <li v-for="(choice, index) in row.choices" :key="index">
                <GitBranch :size="14" aria-hidden="true" />
                <div><strong>{{ choice.text }}<span v-if="choice.count > 1"> · {{ choice.count }}</span></strong><small v-if="choice.options">{{ choice.options }}</small></div>
              </li>
            </ul>
            <div v-for="(gain, index) in row.improvements" :key="`gain-${index}`" class="progression-gain">
              <button type="button" @click="$emit('open-item', gain.item)">{{ gain.item.name }}</button><span>{{ gain.text }}</span>
            </div>
            <p v-for="resource in row.resources" :key="resource" class="progression-resource">{{ resource }}</p>
            <div v-if="row.spells.length" class="progression-spells">
              <span>Дарованные заклинания</span>
              <button v-for="(spell, index) in row.spells" :key="index" type="button" @click="$emit('open-item', spellById[spell.spellId] || { id: spell.spellId, typeId: 5 })">
                {{ spellById[spell.spellId]?.name || `Заклинание #${spell.spellId}` }}<small v-if="spell.option"> · {{ spell.option }}</small>
              </button>
            </div>
            <div v-if="row.slots.isCaster || row.casting" class="progression-magic">
              <span v-if="row.casting?.cantripsKnown != null">Заговоры <b>{{ row.casting.cantripsKnown }}</b></span>
              <span v-if="row.casting?.spellsKnown != null">Известные <b>{{ row.casting.spellsKnown }}</b></span>
              <span v-if="row.casting?.prepares">Подготовка заклинаний</span>
              <span v-for="slot in slotLabels(row.slots)" :key="slot">{{ slot }}</span>
            </div>
            <p v-if="!hasEvents(row)" class="progression-quiet">Новых умений в справочнике не указано.</p>
          </div>
        </li>
      </ol>
    </template>
  </DetailSection>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { ArrowUpRight, GitBranch, TrendingUp } from '@lucide/vue'
import { FormSelect } from '@sylvieshare/share-ui'
import DetailSection from '@/shared/ui/DetailSection.vue'
import { itemsApi } from '@/shared/api/itemsApi'
import { classProgression } from '@/features/items/lib/classProgression'

const props = defineProps({
  classItem: { type: Object, required: true },
  subclasses: { type: Array, default: () => [] },
  fixedSubclass: { type: Object, default: null },
})
defineEmits(['open-item'])
const selectedId = ref('')
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
    const response = await itemsApi.listAll(4, {}, { class_ids: [props.classItem.id] })
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
function hasEvents(row) { return row.features.length || row.choices.length || row.improvements.length || row.resources.length || row.spells.length }
function slotLabels(slots) {
  const result = slots.totals.flatMap((count, index) => count ? [`${index + 1} круг: ${count} яч.`] : [])
  if (slots.pact) result.push(`Магия договора: ${slots.pact.count} яч. ${slots.pact.slotLevel} круга · короткий отдых`)
  return result
}
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
.progression-level-heading b { color: var(--text-2); margin-left: 4px; }
.progression-hp { margin: 0 0 12px; color: var(--text-muted); font-size: 11px; }
.progression-level-heading > small { color: var(--accent-soft); text-transform: uppercase; letter-spacing: .08em; font-weight: 700; }
.progression-features { display: flex; flex-wrap: wrap; gap: 8px 18px; }
.progression-features button { display: inline-flex; align-items: baseline; gap: 4px; font-weight: 650; font-size: 14px; }
.progression-body button, .progression-message button { padding: 0; background: none; border: none; color: var(--accent-soft); font-family: inherit; text-align: left; cursor: pointer; }
.progression-body button:hover, .progression-message button:hover { text-decoration: underline; }
.progression-choices { list-style: none; padding: 10px 12px; margin: 12px 0 0; border-left: 2px solid var(--accent); background: color-mix(in srgb, var(--accent) 7%, transparent); }
.progression-choices li { display: flex; gap: 8px; padding: 4px 0; color: var(--accent-soft); font-size: 12px; }
.progression-choices svg { flex: none; margin-top: 2px; }
.progression-choices strong { font-weight: 550; }
.progression-choices small { display: block; margin-top: 4px; color: var(--text-muted); font-size: 11px; line-height: 1.5; }
.progression-gain { display: flex; flex-wrap: wrap; gap: 4px 10px; font-size: 12px; margin-top: 9px; color: var(--text-2); }
.progression-gain button { font-size: inherit; }
.progression-resource, .progression-quiet { font-size: 12px; color: var(--text-muted); margin: 10px 0 0; }
.progression-spells { display: flex; flex-wrap: wrap; gap: 6px 12px; margin-top: 12px; font-size: 12px; }
.progression-spells > span { color: var(--text-muted); }
.progression-magic { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 12px; }
.progression-magic span { padding: 4px 7px; border: 1px solid var(--border); border-radius: 5px; color: var(--text-2); font-size: 10px; }
.progression-message { padding: 18px 0; color: var(--text-muted); font-size: 13px; }
@media (max-width: 600px) { .progression-intro { flex-direction: column; gap: 12px; } .progression-selector { flex: auto; width: 100%; } .progression-level { grid-template-columns: 42px minmax(0, 1fr); gap: 10px; } }
</style>
