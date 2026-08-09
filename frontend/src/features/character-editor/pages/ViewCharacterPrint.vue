<template>
  <main class="print-view">
    <nav class="print-actions" aria-label="Действия с печатным листом">
      <button type="button" class="action action--quiet" @click="goBack">
        <span aria-hidden="true">←</span>
        К персонажу
      </button>
      <button type="button" class="action action--primary" :disabled="loading || !!error" @click="printSheet">
        <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M6 9V2h9l3 3v4" />
          <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
          <rect x="6" y="14" width="12" height="8" rx="1" />
        </svg>
        Печать / PDF
      </button>
    </nav>

    <section v-if="loading" class="paper paper--message" aria-live="polite">
      <div class="paper-message">Готовим лист персонажа…</div>
    </section>

    <section v-else-if="error" class="paper paper--message">
      <div class="paper-message paper-message--error">
        <strong>Не удалось открыть персонажа</strong>
        <span>{{ error }}</span>
      </div>
    </section>

    <article v-else class="paper">
      <header class="identity">
        <div class="identity-name">
          <div class="overline">Лист персонажа</div>
          <h1>{{ characterName }}</h1>
          <div class="write-line"></div>
        </div>
        <div class="identity-fields">
          <PrintField label="Класс и уровень" :value="classAndLevel" />
          <PrintField label="Раса" :value="displayRef(values.race)" />
          <PrintField label="Предыстория" :value="displayRef(values.background) || text(values.person_origin)" />
          <PrintField label="Мировоззрение" :value="text(values.person_alignment)" />
        </div>
      </header>

      <section class="page-grid page-grid--main">
        <div class="stats-column">
          <section class="ability-list" aria-label="Характеристики">
            <div v-for="stat in abilities" :key="stat.key" class="ability-box">
              <div class="ability-name">{{ stat.short }}</div>
              <div class="ability-mod">{{ signed(stat.mod) }}</div>
              <div class="ability-score">{{ stat.score }}</div>
            </div>
          </section>

          <section class="box save-box">
            <h2>Спасброски</h2>
            <div v-for="stat in abilities" :key="'save-' + stat.key" class="line-row">
              <span class="prof-dot" :class="{ filled: stat.saveProficient }"></span>
              <strong>{{ signed(stat.save) }}</strong>
              <span>{{ stat.full }}</span>
            </div>
          </section>
        </div>

        <div class="center-column">
          <section class="combat-grid">
            <MetricBox label="Класс доспеха" :value="armorClass" />
            <MetricBox label="Инициатива" :value="signed(initiative)" />
            <MetricBox label="Скорость" :value="speedLabel" />
            <MetricBox label="Бонус мастерства" :value="signed(profBonus)" />
          </section>

          <section class="box hp-box">
            <div class="hp-max"><span>Максимум хитов</span><strong>{{ hp.max }}</strong></div>
            <div class="hp-current"><strong>{{ hp.current }}</strong><span>Текущие хиты</span></div>
            <div class="hp-temp"><strong>{{ hp.temp || '—' }}</strong><span>Временные хиты</span></div>
          </section>

          <section class="mini-grid">
            <section class="box compact-box">
              <h2>Кость хитов</h2>
              <strong class="large-value">{{ hitDice }}</strong>
            </section>
            <section class="box compact-box death-saves">
              <h2>Спасброски от смерти</h2>
              <div><span>Успехи</span><i v-for="i in 3" :key="'ok-' + i" :class="{ marked: i <= hp.ds_success }"></i></div>
              <div><span>Провалы</span><i v-for="i in 3" :key="'fail-' + i" :class="{ marked: i <= hp.ds_failure }"></i></div>
            </section>
          </section>

          <section class="box attacks-box">
            <h2>Атаки и заклинания</h2>
            <table>
              <thead><tr><th>Название</th><th>Бонус</th><th>Урон / тип</th></tr></thead>
              <tbody>
                <tr v-for="attack in attacks" :key="attack.key">
                  <td>{{ attack.name }}</td><td>{{ signed(attack.bonus) }}</td><td>{{ attack.damage || '—' }}</td>
                </tr>
                <tr v-for="i in attackBlankRows" :key="'attack-empty-' + i"><td>&nbsp;</td><td></td><td></td></tr>
              </tbody>
            </table>
          </section>

          <section class="box notes-box">
            <h2>Заметки</h2>
            <p>{{ text(values.notes) }}</p>
          </section>
        </div>

        <div class="skills-column">
          <section class="box passive-box">
            <strong>{{ passivePerception }}</strong>
            <span>Пассивная мудрость (Восприятие)</span>
          </section>
          <section class="box skills-box">
            <h2>Навыки</h2>
            <div v-for="skill in skills" :key="skill.id" class="line-row">
              <span class="prof-dot" :class="{ filled: skill.rank > 0, expert: skill.rank > 1 }"></span>
              <strong>{{ signed(skill.bonus) }}</strong>
              <span>{{ skill.name }} <small>({{ skill.statShort }})</small></span>
            </div>
          </section>
          <section v-if="proficiencyGroups.length" class="box prose-box">
            <h2>Владения и языки</h2>
            <div v-for="group in proficiencyGroups" :key="group.name" class="prose-group">
              <h3>{{ group.name }}</h3>
              <p>{{ group.value }}</p>
            </div>
          </section>
        </div>
      </section>

      <section v-if="hasEquipment" class="print-section page-break-before">
        <div class="section-heading"><span>02</span><h2>Снаряжение</h2></div>
        <div class="equipment-grid">
          <section class="box inventory-box">
            <h2>Инвентарь</h2>
            <div v-for="section in inventorySections" :key="section.id" class="inventory-section">
              <h3>{{ section.name }}</h3>
              <div v-for="entry in section.items" :key="entry.uid" class="inventory-row">
                <span>{{ entry.name }}</span><strong v-if="entry.count > 1">× {{ entry.count }}</strong>
              </div>
              <div v-if="!section.items.length" class="empty-line">—</div>
            </div>
          </section>
          <div class="equipment-side">
            <section v-if="coins.length" class="box coins-box">
              <h2>Монеты</h2>
              <div v-for="coin in coins" :key="coin.id"><strong>{{ coin.amount }}</strong><span>{{ coin.name }}</span></div>
            </section>
            <section v-if="counters.length" class="box counters-box">
              <h2>Ресурсы</h2>
              <div v-for="counter in counters" :key="counter.id">
                <span>{{ counter.name || 'Ресурс' }}</span>
                <strong>{{ counter.value }}<template v-if="counter.max != null"> / {{ counter.max }}</template> {{ counter.unit }}</strong>
              </div>
            </section>
            <section v-if="potions.length" class="box list-box">
              <h2>Зелья</h2>
              <div v-for="potion in potions" :key="potion.uid"><span>{{ potion.name }}</span><strong>× {{ potion.count }}</strong></div>
            </section>
          </div>
        </div>
      </section>

      <section v-if="hasSpells" class="print-section page-break-before spells-section">
        <div class="section-heading"><span>03</span><h2>Заклинания</h2></div>
        <section class="spell-summary">
          <PrintField label="Базовая характеристика" :value="spellcasting.stat" />
          <PrintField label="Сл спасброска" :value="String(spellcasting.saveDc)" />
          <PrintField label="Бонус атаки" :value="signed(spellcasting.attackBonus)" />
        </section>
        <section v-if="spellSlots.length" class="box slots-box">
          <h2>Ячейки заклинаний</h2>
          <div v-for="slot in spellSlots" :key="slot.level">
            <span>{{ slot.level }} круг</span>
            <i v-for="i in slot.total" :key="i" :class="{ used: i <= slot.used }"></i>
          </div>
        </section>
        <div class="spell-columns">
          <section v-for="group in spellGroups" :key="group.level" class="box spell-level">
            <h2>{{ spellLevelTitle(group.level) }}</h2>
            <div v-for="spell in group.spells" :key="spell.id" class="spell-row">
              <span class="prepare-box" :class="{ checked: spell.prepared }">✓</span>
              <span>{{ spell.name }}</span>
            </div>
          </section>
        </div>
      </section>

      <section v-if="hasDetails" class="print-section page-break-before details-section">
        <div class="section-heading"><span>04</span><h2>Личность и особенности</h2></div>
        <div class="details-grid">
          <section class="box portrait-box">
            <img v-if="avatar" :src="avatar" alt="Портрет персонажа" />
            <div v-else class="portrait-placeholder">Портрет</div>
            <dl>
              <template v-for="field in appearanceFields" :key="field.label">
                <dt>{{ field.label }}</dt><dd>{{ field.value || '—' }}</dd>
              </template>
            </dl>
          </section>
          <div class="personality-column">
            <section v-for="field in personalityFields" :key="field.label" class="box text-box">
              <h2>{{ field.label }}</h2><p>{{ field.value }}</p>
            </section>
          </div>
        </div>
        <section v-if="featureGroups.length" class="features-grid">
          <section v-for="group in featureGroups" :key="group.name" class="box list-box feature-box">
            <h2>{{ group.name }}</h2>
            <div v-for="entry in group.items" :key="entry.key"><span>{{ entry.name }}</span><strong v-if="entry.countText">{{ entry.countText }}</strong></div>
          </section>
        </section>
        <section v-if="text(values.person_backstory)" class="box text-box backstory-box">
          <h2>Предыстория персонажа</h2><p>{{ text(values.person_backstory) }}</p>
        </section>
      </section>
    </article>
  </main>
</template>

<script setup>
import { computed, defineComponent, h, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { fetchGet } from '@/shared/api/http'
import { itemsApi } from '@/shared/api/itemsApi'
import { abilityModifier, proficiencyBonus, resolveNumValue, sumBonuses } from '@/shared/lib/dnd'
import { STAT_FULL, STAT_KEYS, STAT_SHORT, SUGGEST16_TO_STAT } from '@/shared/lib/dndStats'
import { normalizeValue } from '@/features/character-editor/blocks/dnd/lib/itemSection'
import { normalizeCounters } from '@/features/character-editor/blocks/dnd/lib/counterEntry'
import { useSuggestStore } from '@/stores/suggest'

const PrintField = defineComponent({
  props: { label: String, value: String },
  setup(props) {
    return () => h('div', { class: 'print-field' }, [
      h('strong', props.value || '—'),
      h('span', props.label),
    ])
  },
})

const MetricBox = defineComponent({
  props: { label: String, value: [String, Number] },
  setup(props) {
    return () => h('div', { class: 'metric-box' }, [
      h('strong', String(props.value ?? '—')),
      h('span', props.label),
    ])
  },
})

const route = useRoute()
const router = useRouter()
const loading = ref(true)
const error = ref('')
const response = ref(null)
const catalog = ref({})
const suggest = useSuggestStore()

const values = computed(() => response.value?.data?.values || {})
const vars = computed(() => response.value?.data?.var || {})

function text(value) {
  if (value == null) return ''
  if (typeof value === 'object') return String(value.name ?? value.value ?? value.title ?? '')
  return String(value).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
}

function displayRef(value) { return text(value) }
function signed(value) {
  const n = Number(value) || 0
  return `${n >= 0 ? '+' : ''}${n}`
}

const characterName = computed(() => text(values.value.name) || 'Без имени')
const level = computed(() => Number(values.value.lvl?.level ?? values.value.lvl ?? 1) || 1)
const classAndLevel = computed(() => [displayRef(values.value.class), level.value ? `${level.value} ур.` : ''].filter(Boolean).join(', '))
const avatar = computed(() => typeof values.value.ava === 'string' ? values.value.ava : values.value.ava?.url || '')

function abilityScore(key) {
  const raw = values.value[key]
  return resolveNumValue(raw && typeof raw === 'object' && 'value' in raw ? raw.value : raw) || 10
}

const storedProf = computed(() => values.value.prof_bonus || {})
const profBonus = computed(() => {
  const base = storedProf.value.auto === false ? Number(storedProf.value.v) || 0 : proficiencyBonus(level.value)
  return base + sumBonuses(storedProf.value.bonuses)
})

const abilities = computed(() => STAT_KEYS.map(key => {
  const score = abilityScore(key)
  const mod = abilityModifier(score)
  const saveProficient = !!values.value[key]?.save_up
  return {
    key, score, mod,
    short: STAT_SHORT[key],
    full: STAT_FULL[key],
    saveProficient,
    save: mod + (saveProficient ? profBonus.value : 0) + sumBonuses(values.value[key]?.save_bonuses),
  }
}))

const hp = computed(() => ({ current: 0, max: 0, temp: 0, ds_success: 0, ds_failure: 0, ...(values.value.hp || {}) }))
const armorClass = computed(() => {
  const armor = values.value.armor || {}
  return (Number(armor.ac) || 0) + (armor.shield ? Number(armor.shield_bonus) || 0 : 0) + sumBonuses(armor.bonuses)
})
const initiative = computed(() => {
  const data = values.value.initiative
  if (typeof data === 'number') return data
  const dex = data?.use_dex === false ? 0 : abilityModifier(abilityScore('DEX'))
  return (Number(data?.base ?? data?.value) || 0) + sumBonuses(data?.bonuses) + dex
})
const speedLabel = computed(() => `${Number(values.value.speed?.value ?? values.value.speed) || 0} фт.`)
const hitDice = computed(() => {
  const dice = text(hp.value.dice) || 'd8'
  const total = Number(hp.value.diceCount) || level.value
  const used = Number(hp.value.diceUsed) || 0
  return `${Math.max(0, total - used)}${dice} / ${total}${dice}`
})

const SKILL_STAT = { 1: 'STR', 2: 'DEX', 3: 'DEX', 4: 'DEX', 5: 'INT', 6: 'INT', 7: 'INT', 8: 'INT', 9: 'INT', 10: 'WIS', 11: 'WIS', 12: 'WIS', 13: 'WIS', 14: 'WIS', 15: 'CHA', 16: 'CHA', 17: 'CHA', 18: 'CHA' }
const SKILL_FALLBACK = {
  1: 'Атлетика', 2: 'Акробатика', 3: 'Ловкость рук', 4: 'Скрытность', 5: 'Анализ', 6: 'История',
  7: 'Магия', 8: 'Природа', 9: 'Религия', 10: 'Восприятие', 11: 'Выживание', 12: 'Медицина',
  13: 'Проницательность', 14: 'Уход за животными', 15: 'Выступление', 16: 'Запугивание', 17: 'Обман', 18: 'Убеждение',
}
const skills = computed(() => Object.entries(SKILL_STAT).map(([id, stat]) => {
  const stored = values.value[stat]?.skills?.[id] || {}
  const rank = Number(stored.up) || 0
  const name = stored.override_title || suggest.items(15).find(item => String(item.id) === id)?.value || SKILL_FALLBACK[id]
  return {
    id, name, rank,
    statShort: STAT_SHORT[stat],
    bonus: abilityModifier(abilityScore(stat)) + rank * profBonus.value + sumBonuses(stored.bonuses),
  }
}))
const passivePerception = computed(() => 10 + (skills.value.find(skill => skill.id === '10')?.bonus || 0))

function itemById(id) { return catalog.value[String(id)] || catalog.value[id] || null }
function diceLabel(id, fallback = '') { return suggest.items(11).find(item => String(item.id) === String(id))?.value || fallback || '' }
function damageType(id) { return suggest.items(12).find(item => String(item.id) === String(id))?.value || '' }
function attackParts(entry, item) {
  const parts = [...(item?.data?.attacks || item?.data?.add_attacks || []), ...(entry.add_attacks || [])]
  const result = parts.map(part => {
    const die = diceLabel(part.dice_id ?? part.dice_suggest_id, part.v ?? part.dice)
    const type = damageType(part.type ?? part.type_suggest_id)
    return [die ? `${Number(part.count) || 1}${die}` : '', type].filter(Boolean).join(' ')
  }).filter(Boolean)
  const statKey = SUGGEST16_TO_STAT[Number(entry.stat_suggest_id)]
  const flat = (statKey ? abilityModifier(abilityScore(statKey)) : 0) + (Number(entry.magic_up) || 0)
  if (flat && result.length) result[0] += signed(flat)
  return result.join(' + ')
}
const attacks = computed(() => (Array.isArray(values.value.weapon) ? values.value.weapon : []).map((entry, index) => {
  const item = itemById(entry.item_id)
  const statKey = SUGGEST16_TO_STAT[Number(entry.stat_suggest_id)]
  const statMod = statKey ? abilityModifier(abilityScore(statKey)) : Number(vars.value.stats?.[String(entry.stat_suggest_id)]) || 0
  return {
    key: `${entry.item_id}-${index}`,
    name: item?.name || `Оружие #${entry.item_id || '—'}`,
    bonus: statMod + (Number(entry.magic_up) || 0) + (entry.proficient ? profBonus.value : 0),
    damage: attackParts(entry, item),
  }
}))
const attackBlankRows = computed(() => Math.max(0, 5 - attacks.value.length))

const proficiencyGroups = computed(() => Object.entries(values.value.proficiencies || {}).map(([name, value]) => ({
  name,
  value: Array.isArray(value) ? value.map(text).filter(Boolean).join(', ') : text(value),
})).filter(group => group.value))

const inventoryModel = computed(() => normalizeValue(values.value.items))
function inventoryEntry(entry) {
  const item = itemById(entry.id)
  return { ...entry, name: entry.override?.name || item?.name || (entry.id != null ? `Предмет #${entry.id}` : 'Предмет') }
}
const inventorySections = computed(() => [
  { id: 'equipped', name: 'Экипировано', items: inventoryModel.value.equipped.map(inventoryEntry) },
  ...inventoryModel.value.sections.map(section => ({ ...section, items: section.items.map(inventoryEntry) })),
].filter(section => section.items.length))
const counters = computed(() => normalizeCounters(values.value.counters))
const coins = computed(() => {
  const raw = values.value.money?.amounts || values.value.money || {}
  return Object.entries(raw).filter(([, amount]) => Number(amount)).map(([id, amount]) => ({
    id, amount: Number(amount), name: suggest.items(17).find(item => String(item.id) === id)?.short_title || suggest.items(17).find(item => String(item.id) === id)?.value || `мон. ${id}`,
  }))
})
const potions = computed(() => (Array.isArray(values.value.potions) ? values.value.potions : []).map(entry => ({
  ...entry,
  count: Number(entry.count) || 1,
  name: entry.override?.name || itemById(entry.id)?.name || 'Зелье',
})))
const hasEquipment = computed(() => inventorySections.value.length || counters.value.length || coins.value.length || potions.value.length)

const rawSpells = computed(() => Array.isArray(values.value.spells) ? values.value.spells : values.value.spells?.spells || [])
const spellSlots = computed(() => (Array.isArray(values.value.spells?.slots) ? values.value.spells.slots : []).filter(slot => Number(slot.total) > 0))
const spellcasting = computed(() => {
  const data = Array.isArray(values.value.spells) ? {} : values.value.spells || {}
  const statKey = SUGGEST16_TO_STAT[Number(data.stat_path)]
  const mod = statKey ? abilityModifier(abilityScore(statKey)) : 0
  return {
    stat: statKey ? STAT_FULL[statKey] : '—',
    saveDc: 8 + profBonus.value + mod + (Number(data.save_bonus) || 0),
    attackBonus: profBonus.value + mod + (Number(data.attack_bonus) || 0),
  }
})
const spellGroups = computed(() => {
  const groups = new Map()
  for (const spell of rawSpells.value) {
    const item = itemById(spell.id)
    const levelValue = Number(item?.data?.lvl ?? -1)
    if (!groups.has(levelValue)) groups.set(levelValue, [])
    groups.get(levelValue).push({ ...spell, name: item?.name || `Заклинание #${spell.id}` })
  }
  return [...groups.entries()].sort((a, b) => a[0] - b[0]).map(([levelValue, spells]) => ({ level: levelValue, spells }))
})
const hasSpells = computed(() => rawSpells.value.length || spellSlots.value.length)
function spellLevelTitle(value) { return value === 0 ? 'Заговоры' : value > 0 ? `${value} круг` : 'Без уровня' }

const appearanceFields = computed(() => [
  { label: 'Возраст', value: text(values.value.person_age) }, { label: 'Рост', value: text(values.value.person_height) },
  { label: 'Вес', value: text(values.value.person_weight) }, { label: 'Глаза', value: text(values.value.person_eyes) },
  { label: 'Кожа', value: text(values.value.person_skin) }, { label: 'Волосы', value: text(values.value.person_hair) },
])
const personalityFields = computed(() => [
  { label: 'Черты характера', value: text(values.value.person_traits) }, { label: 'Идеалы', value: text(values.value.person_ideals) },
  { label: 'Привязанности', value: text(values.value.person_bonds) }, { label: 'Слабости', value: text(values.value.person_flaws) },
  { label: 'Внешность', value: text(values.value.person_appearance) }, { label: 'Союзники и организации', value: text(values.value.person_allies) },
].filter(field => field.value))
const featureGroups = computed(() => [
  { name: 'Расовые особенности', value: values.value.abilities_race },
  { name: 'Классовые особенности', value: values.value.abilities_class },
  { name: 'Черты', value: values.value.abilities_feats },
].map(group => ({
  name: group.name,
  items: (Array.isArray(group.value) ? group.value : []).map((entry, index) => ({
    key: entry.uid || `${entry.id}-${index}`,
    name: itemById(entry.id)?.name || entry.name || `Особенность #${entry.id || '—'}`,
    countText: entry.max_use != null ? `${entry.count ?? entry.max_use} / ${entry.max_use}` : '',
  })),
})).filter(group => group.items.length))
const hasDetails = computed(() => avatar.value || appearanceFields.value.some(field => field.value) || personalityFields.value.length || featureGroups.value.length || text(values.value.person_backstory))

function collectItemIds(data) {
  const ids = new Set()
  const add = id => { if (id != null && id !== '') ids.add(id) }
  for (const entry of data.weapon || []) add(entry.item_id)
  const inv = normalizeValue(data.items)
  inv.equipped.forEach(entry => add(entry.id))
  inv.sections.forEach(section => section.items.forEach(entry => add(entry.id)))
  ;(Array.isArray(data.potions) ? data.potions : []).forEach(entry => add(entry.id))
  const spellEntries = Array.isArray(data.spells) ? data.spells : data.spells?.spells || []
  spellEntries.forEach(entry => add(entry.id))
  for (const key of ['abilities_race', 'abilities_class', 'abilities_feats']) (data[key] || []).forEach(entry => add(entry.id))
  return [...ids]
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    const res = await fetchGet('/char/' + route.params.uuid)
    if (!res?.data || res?.type) throw new Error(res?.desc || 'Персонаж не найден или недоступен.')
    response.value = res
    const itemIds = collectItemIds(res.data?.values || {})
    const tasks = [15, 17, 11, 12].map(id => suggest.ensure(id).catch(() => null))
    if (itemIds.length) tasks.push(itemsApi.byIds(itemIds).then(result => {
      catalog.value = Object.fromEntries((result?.items || []).map(item => [String(item.id), item]))
    }).catch(() => null))
    await Promise.all(tasks)
    document.title = `${characterName.value} — лист для печати`
  } catch (e) {
    error.value = e?.message || 'Произошла ошибка при загрузке.'
  } finally {
    loading.value = false
  }
}

function goBack() { router.push({ name: 'Character', params: { uuid: route.params.uuid } }) }
function printSheet() { window.print() }

onMounted(() => {
  document.documentElement.classList.add('character-print-mode')
  window.scrollTo(0, 0)
  load()
})
onBeforeUnmount(() => document.documentElement.classList.remove('character-print-mode'))
</script>

<style scoped>
.print-view {
  min-height: 100vh;
  padding: 28px 20px 64px;
  background: #ecebe7;
  color: #1e1e1c;
  color-scheme: light;
  font-family: Arial, Helvetica, sans-serif;
}
.print-actions { width: min(210mm, 100%); margin: 0 auto 16px; display: flex; justify-content: space-between; gap: 12px; }
.action { min-height: 40px; display: inline-flex; align-items: center; justify-content: center; gap: 8px; padding: 0 15px; border: 1px solid #c8c7c2; border-radius: 8px; font: 600 13px/1 Arial, sans-serif; cursor: pointer; }
.action--quiet { background: #fff; color: #333; }
.action--primary { background: #222; border-color: #222; color: #fff; }
.action:disabled { opacity: .45; cursor: default; }
.paper { width: min(210mm, 100%); min-height: 297mm; margin: 0 auto; padding: 13mm 12mm 14mm; background: #fff; box-shadow: 0 18px 55px rgba(34, 32, 27, .15); }
.paper--message { display: grid; place-items: center; }
.paper-message { display: flex; flex-direction: column; align-items: center; gap: 8px; color: #777; }
.paper-message--error strong { color: #8e2929; }
.identity { display: grid; grid-template-columns: minmax(0, 1.05fr) minmax(0, 1.7fr); gap: 10mm; align-items: end; padding-bottom: 5mm; border-bottom: 2px solid #272723; }
.overline { margin-bottom: 2mm; font: 700 8px/1 Arial, sans-serif; letter-spacing: .22em; text-transform: uppercase; color: #777; }
.identity h1 { margin: 0; font: 700 30px/1.05 Georgia, serif; overflow-wrap: anywhere; }
.write-line { margin-top: 2mm; border-bottom: 1px solid #999; }
.identity-fields, .spell-summary { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 4mm 6mm; }
.print-field { min-width: 0; border-bottom: 1px solid #8d8d88; padding: 0 1mm 1.2mm; }
.print-field strong { display: block; min-height: 15px; font: 600 11px/1.2 Arial, sans-serif; overflow-wrap: anywhere; }
.print-field span { display: block; margin-top: 1mm; font-size: 7px; line-height: 1; letter-spacing: .09em; text-transform: uppercase; color: #666; }
.page-grid { display: grid; gap: 4mm; margin-top: 5mm; }
.page-grid--main { grid-template-columns: 28mm minmax(0, 1fr) 54mm; align-items: start; }
.stats-column, .center-column, .skills-column, .equipment-side, .personality-column { display: flex; flex-direction: column; gap: 4mm; min-width: 0; }
.ability-list { display: flex; flex-direction: column; gap: 3mm; }
.ability-box { position: relative; min-height: 31mm; padding: 3mm 2mm 5mm; border: 1.4px solid #333; border-radius: 4mm; text-align: center; }
.ability-name { font-size: 7px; font-weight: 800; letter-spacing: .08em; }
.ability-mod { margin-top: 2mm; font: 700 23px/1 Georgia, serif; }
.ability-score { position: absolute; left: 50%; bottom: -4mm; translate: -50% 0; min-width: 13mm; padding: 1.5mm 2mm; border: 1.2px solid #333; border-radius: 50%; background: #fff; font: 700 11px/1 Arial, sans-serif; }
.box { border: 1.2px solid #333; border-radius: 2.5mm; padding: 3mm; break-inside: avoid; }
.box > h2 { margin: 0 0 2.5mm; font: 800 8px/1.1 Arial, sans-serif; letter-spacing: .08em; text-align: center; text-transform: uppercase; }
.line-row { display: grid; grid-template-columns: 4mm 8mm 1fr; align-items: center; gap: 1.5mm; min-height: 5.5mm; font-size: 8px; border-bottom: .35px solid #d5d5d0; }
.line-row:last-child { border-bottom: 0; }
.line-row strong { font-size: 9px; text-align: center; }
.line-row small { color: #777; font-size: 6.5px; }
.prof-dot { width: 2.8mm; height: 2.8mm; border: 1px solid #333; border-radius: 50%; }
.prof-dot.filled { background: #333; box-shadow: inset 0 0 0 .7mm #fff; }
.prof-dot.expert { box-shadow: inset 0 0 0 .45mm #fff, inset 0 0 0 1mm #333; background: #fff; }
.combat-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 2.5mm; }
.metric-box { min-height: 25mm; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2mm; padding: 2mm 1mm; border: 1.3px solid #333; border-radius: 5mm 5mm 2mm 2mm; text-align: center; }
.metric-box strong { font: 700 21px/1 Georgia, serif; }
.metric-box span { font-size: 6px; font-weight: 800; line-height: 1.15; letter-spacing: .06em; text-transform: uppercase; }
.hp-box { display: grid; grid-template-columns: 1fr 1fr; gap: 3mm; }
.hp-box > div { display: flex; align-items: center; justify-content: center; gap: 2mm; text-align: center; }
.hp-max { grid-column: 1 / -1; padding-bottom: 2mm; border-bottom: 1px solid #aaa; font-size: 8px; }
.hp-max strong { font-size: 13px; }
.hp-current, .hp-temp { min-height: 18mm; flex-direction: column; }
.hp-current { border-right: 1px solid #bbb; }
.hp-current strong, .hp-temp strong { font: 700 22px/1 Georgia, serif; }
.hp-current span, .hp-temp span { font-size: 6px; font-weight: 800; text-transform: uppercase; }
.mini-grid { display: grid; grid-template-columns: .8fr 1.2fr; gap: 3mm; }
.compact-box { min-height: 19mm; text-align: center; }
.large-value { font: 700 14px/1 Georgia, serif; }
.death-saves > div { display: flex; justify-content: flex-end; align-items: center; gap: 1.2mm; font-size: 6.5px; margin-top: 1.5mm; }
.death-saves i, .slots-box i { width: 3mm; height: 3mm; display: inline-block; border: 1px solid #333; border-radius: 50%; }
.death-saves i.marked, .slots-box i.used { background: #333; box-shadow: inset 0 0 0 .55mm white; }
table { width: 100%; border-collapse: collapse; table-layout: fixed; font-size: 7.5px; }
th { padding: 1.4mm; border-bottom: 1px solid #555; color: #666; font-size: 6px; letter-spacing: .06em; text-align: left; text-transform: uppercase; }
td { height: 6mm; padding: 1.2mm 1.4mm; border-bottom: .4px solid #aaa; overflow-wrap: anywhere; }
th:nth-child(2), td:nth-child(2) { width: 17%; text-align: center; } th:nth-child(3), td:nth-child(3) { width: 39%; }
.notes-box { min-height: 34mm; }
.notes-box p, .text-box p { margin: 0; white-space: pre-wrap; overflow-wrap: anywhere; font: 9px/1.45 Georgia, serif; }
.passive-box { display: flex; align-items: center; gap: 2.5mm; }
.passive-box strong { flex: 0 0 auto; width: 9mm; font: 700 14px/1 Georgia, serif; text-align: center; }
.passive-box span { font-size: 6px; font-weight: 800; line-height: 1.2; text-transform: uppercase; }
.skills-box { padding-inline: 2.5mm; }
.skills-box .line-row { grid-template-columns: 3.5mm 7mm 1fr; min-height: 5.1mm; }
.prose-group + .prose-group { margin-top: 2.5mm; }
.prose-group h3, .inventory-section h3 { margin: 0 0 1mm; font-size: 7px; text-transform: uppercase; color: #666; }
.prose-group p { margin: 0; font: 8px/1.35 Georgia, serif; }
.print-section { margin-top: 12mm; padding-top: 4mm; border-top: 2px solid #272723; }
.section-heading { display: flex; align-items: baseline; gap: 3mm; margin-bottom: 6mm; }
.section-heading span { font: 700 8px/1 Arial, sans-serif; color: #999; }
.section-heading h2 { margin: 0; font: 700 22px/1 Georgia, serif; }
.equipment-grid { display: grid; grid-template-columns: minmax(0, 1fr) 58mm; gap: 5mm; align-items: start; }
.inventory-section + .inventory-section { margin-top: 4mm; }
.inventory-row, .list-box > div, .counters-box > div { display: flex; justify-content: space-between; gap: 4mm; min-height: 6mm; padding: 1.2mm 0; border-bottom: .4px solid #bbb; font-size: 9px; }
.inventory-row span, .list-box span { overflow-wrap: anywhere; }
.inventory-row strong, .list-box strong { white-space: nowrap; }
.empty-line { color: #999; }
.coins-box { display: grid; grid-template-columns: repeat(3, 1fr); gap: 2mm; }
.coins-box h2 { grid-column: 1 / -1; }
.coins-box > div { text-align: center; }
.coins-box strong { display: block; font: 700 14px/1 Georgia, serif; }
.coins-box span { display: block; margin-top: 1mm; font-size: 6px; text-transform: uppercase; }
.spell-summary { grid-template-columns: repeat(3, minmax(0, 1fr)); margin-bottom: 5mm; }
.slots-box { display: flex; align-items: flex-start; flex-wrap: wrap; gap: 3mm 7mm; margin-bottom: 5mm; }
.slots-box h2 { width: 100%; text-align: left; }
.slots-box > div { display: flex; align-items: center; gap: 1mm; font-size: 8px; }
.slots-box > div > span { min-width: 12mm; font-weight: 700; }
.spell-columns { columns: 3; column-gap: 4mm; }
.spell-level { display: inline-block; width: 100%; margin-bottom: 4mm; }
.spell-row { display: grid; grid-template-columns: 4mm 1fr; align-items: center; gap: 2mm; min-height: 5.5mm; border-bottom: .4px solid #bbb; font-size: 8px; }
.prepare-box { width: 3mm; height: 3mm; display: inline-grid; place-items: center; border: 1px solid #555; font-size: 0; }
.prepare-box.checked { font-size: 8px; }
.details-grid { display: grid; grid-template-columns: 55mm minmax(0, 1fr); gap: 5mm; align-items: start; }
.portrait-box img, .portrait-placeholder { width: 100%; aspect-ratio: 4 / 5; object-fit: cover; filter: grayscale(1); border: 1px solid #aaa; }
.portrait-placeholder { display: grid; place-items: center; color: #aaa; font: italic 11px Georgia, serif; }
.portrait-box dl { display: grid; grid-template-columns: auto 1fr; gap: 1.5mm 3mm; margin: 4mm 0 0; }
.portrait-box dt { font-size: 6px; font-weight: 800; text-transform: uppercase; color: #666; }
.portrait-box dd { margin: 0; border-bottom: .4px solid #aaa; font: 8px Georgia, serif; }
.text-box { min-height: 22mm; }
.features-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 4mm; margin-top: 5mm; align-items: start; }
.backstory-box { margin-top: 5mm; min-height: 40mm; }

@media (max-width: 760px) {
  .print-view { padding: 14px 0 40px; }
  .print-actions { padding: 0 12px; }
  .paper { width: 100%; min-width: 720px; padding: 28px; transform-origin: top left; }
  .print-view { overflow-x: auto; }
}

@media print {
  @page { size: A4 portrait; margin: 0; }
  .print-view { min-height: 0; padding: 0; background: #fff; }
  .print-actions { display: none !important; }
  .paper { width: 210mm; min-height: 297mm; margin: 0; padding: 11mm 10mm 12mm; box-shadow: none; }
  .page-break-before { break-before: page; margin-top: 0; padding-top: 4mm; }
  .box, .ability-box, .identity, .section-heading { break-inside: avoid; }
  * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
}
</style>

<style>
html.character-print-mode,
html.character-print-mode body,
html.character-print-mode #app {
  background: #ecebe7 !important;
  color-scheme: light;
}
html.character-print-mode body { overflow-x: auto; }
@media print {
  html.character-print-mode,
  html.character-print-mode body,
  html.character-print-mode #app,
  html.character-print-mode .page-transition-stage,
  html.character-print-mode .page-transition-stage--print { background: #fff !important; }
  html.character-print-mode body { overflow: visible; }
}
</style>
