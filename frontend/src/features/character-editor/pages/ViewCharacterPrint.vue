<template>
  <main class="print-view">
    <nav class="print-actions" aria-label="Действия с печатным листом">
      <button type="button" class="action action--quiet" @click="goBack"><span aria-hidden="true">←</span> К персонажу</button>
      <button type="button" class="action action--primary" :disabled="loading || !!error" @click="printSheet">
        <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M6 9V2h9l3 3v4" /><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><rect x="6" y="14" width="12" height="8" rx="1" />
        </svg>
        Печать / PDF
      </button>
    </nav>

    <PrintPage v-if="loading" message><div class="paper-message">Готовим лист персонажа…</div></PrintPage>
    <PrintPage v-else-if="error" message>
      <div class="paper-message paper-message--error"><strong>Не удалось открыть персонажа</strong><span>{{ error }}</span></div>
    </PrintPage>

    <div v-else class="print-document">
      <PrintPage number="01">
        <header class="identity">
          <div class="identity-name">
            <div class="overline"><span>✦</span> Лист персонажа <span>✦</span></div>
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

        <section class="main-grid">
          <div class="stats-column">
            <section class="ability-list" aria-label="Характеристики">
              <div v-for="stat in abilities" :key="stat.key" class="ability-box">
                <div class="ability-name">{{ stat.short }}</div><div class="ability-mod">{{ signed(stat.mod) }}</div><div class="ability-score">{{ stat.score }}</div>
              </div>
            </section>
            <section class="box save-box">
              <BoxTitle>Спасброски</BoxTitle>
              <div v-for="stat in abilities" :key="'save-' + stat.key" class="line-row">
                <span class="prof-dot" :class="{ filled: stat.saveProficient }"></span><strong>{{ signed(stat.save) }}</strong><span>{{ stat.full }}</span>
              </div>
            </section>
          </div>

          <div class="center-column">
            <section class="combat-grid">
              <MetricBox label="Класс доспеха" :value="armorClass" /><MetricBox label="Инициатива" :value="signed(initiative)" />
              <MetricBox label="Скорость" :value="speedLabel" /><MetricBox label="Бонус мастерства" :value="signed(profBonus)" />
            </section>
            <section class="box hp-box">
              <div class="hp-max"><span>Максимум хитов</span><strong>{{ hp.max }}</strong></div>
              <div class="hp-current"><strong>{{ hp.current }}</strong><span>Текущие хиты</span></div>
              <div class="hp-temp"><strong>{{ hp.temp || '—' }}</strong><span>Временные хиты</span></div>
            </section>
            <section class="mini-grid">
              <section class="box compact-box"><BoxTitle>Кость хитов</BoxTitle><strong class="large-value">{{ hitDice }}</strong></section>
              <section class="box compact-box death-saves"><BoxTitle>Спасброски от смерти</BoxTitle>
                <div><span>Успехи</span><i v-for="i in 3" :key="'ok-' + i" :class="{ marked: i <= hp.ds_success }"></i></div>
                <div><span>Провалы</span><i v-for="i in 3" :key="'fail-' + i" :class="{ marked: i <= hp.ds_failure }"></i></div>
              </section>
            </section>
            <section class="box attacks-box"><BoxTitle>Атаки</BoxTitle>
              <table><thead><tr><th>Название</th><th>Бонус</th><th>Урон / тип</th></tr></thead><tbody>
                <template v-for="attack in attacks" :key="attack.key">
                  <tr class="attack-row">
                    <td><strong class="attack-name">{{ attack.name }}</strong><span v-if="attack.properties" class="attack-properties">{{ attack.properties }}</span></td>
                    <td>{{ signed(attack.bonus) }}</td><td>{{ attack.damage || '—' }}</td>
                  </tr>
                  <tr v-if="attack.description" class="attack-description-row"><td colspan="3"><RichContent :html="attack.description" /></td></tr>
                </template>
                <tr v-for="i in attackBlankRows" :key="'attack-empty-' + i"><td>&nbsp;</td><td></td><td></td></tr>
              </tbody></table>
            </section>
          </div>

          <div class="skills-column">
            <section class="box passive-box"><strong>{{ passivePerception }}</strong><span>Пассивная мудрость<br>(Восприятие)</span></section>
            <section class="box skills-box"><BoxTitle>Навыки</BoxTitle>
              <div v-for="skill in skills" :key="skill.id" class="line-row">
                <span class="prof-dot" :class="{ filled: skill.rank > 0, expert: skill.rank > 1 }"></span><strong>{{ signed(skill.bonus) }}</strong><span>{{ skill.name }} <small>({{ skill.statShort }})</small></span>
              </div>
            </section>
          </div>
        </section>
        <section v-if="mainProficiencyGroups.length" class="box main-proficiencies">
          <BoxTitle>Владения и языки</BoxTitle>
          <div class="main-proficiency-grid">
            <div v-for="group in mainProficiencyGroups" :key="group.name" class="prose-group">
              <h3>{{ group.name }}</h3><p>{{ group.value }}</p>
            </div>
          </div>
        </section>
      </PrintPage>

      <PrintPage
        v-for="(page, index) in featurePages"
        :key="'features-' + index"
        :number="pageNumber(featuresStart + index)"
        :title="index ? 'Особенности и черты · продолжение' : 'Особенности и черты'"
      >
        <div class="feature-grid"><PrintFeatureCard v-for="feature in page.cards" :key="feature.key" :feature="feature" /></div>
      </PrintPage>

      <PrintPage
        v-for="(page, index) in equipmentPages"
        :key="'equipment-' + index"
        :number="pageNumber(equipmentStart + index)"
        :title="index ? 'Снаряжение · продолжение' : 'Снаряжение'"
      >
        <div class="equipment-grid" :class="{ 'equipment-grid--full': index > 0 || !hasEquipmentSide }">
          <section class="box inventory-box"><BoxTitle>Инвентарь</BoxTitle>
            <div v-for="section in page.sections" :key="section.id + '-' + index" class="inventory-section">
              <h3>{{ section.name }}</h3>
              <div v-for="entry in section.items" :key="entry.uid" class="inventory-row"><span>{{ entry.name }}</span><strong v-if="entry.count > 1">× {{ entry.count }}</strong></div>
            </div>
            <div v-if="!page.sections.length" class="empty-state">Инвентарь пуст</div>
          </section>
          <div v-if="index === 0 && hasEquipmentSide" class="equipment-side">
            <section v-if="coins.length" class="box coins-box"><BoxTitle>Монеты</BoxTitle><div v-for="coin in coins" :key="coin.id"><strong>{{ coin.amount }}</strong><span>{{ coin.name }}</span></div></section>
            <section v-if="counters.length" class="box list-box"><BoxTitle>Ресурсы</BoxTitle><div v-for="counter in counters" :key="counter.id"><span>{{ counter.name || 'Ресурс' }}</span><strong>{{ counter.value }}<template v-if="counter.max != null"> / {{ counter.max }}</template> {{ counter.unit }}</strong></div></section>
            <section v-if="potions.length" class="box list-box"><BoxTitle>Зелья</BoxTitle><div v-for="potion in potions" :key="potion.uid"><span>{{ potion.name }}</span><strong>× {{ potion.count }}</strong></div></section>
            <section v-if="equipmentProficiencyGroups.length" class="box prose-box"><BoxTitle>Владения и языки</BoxTitle><div v-for="group in equipmentProficiencyGroups" :key="group.name" class="prose-group"><h3>{{ group.name }}</h3><p>{{ group.value }}</p></div></section>
          </div>
        </div>
      </PrintPage>

      <PrintPage
        v-for="(page, index) in spellPages"
        :key="'spells-' + index"
        :number="pageNumber(spellStart + index)"
        :title="index ? 'Заклинания · продолжение' : 'Заклинания'"
      >
        <template v-if="index === 0">
          <section class="spell-summary">
            <PrintField label="Базовая характеристика" :value="spellcasting.stat" /><PrintField label="Сл спасброска" :value="String(spellcasting.saveDc)" /><PrintField label="Бонус атаки" :value="signed(spellcasting.attackBonus)" />
          </section>
          <section v-if="spellSlots.length" class="box slots-box"><BoxTitle>Ячейки заклинаний</BoxTitle>
            <div v-for="slot in spellSlots" :key="slot.level"><span>{{ slot.level }} круг</span><i v-for="i in slot.total" :key="i" :class="{ used: i <= slot.used }"></i></div>
          </section>
        </template>
        <div class="spell-card-grid"><PrintSpellCard v-for="spell in page.cards" :key="spell.id" :spell="spell" /></div>
        <div v-if="!page.cards.length" class="empty-state">Список заклинаний пуст</div>
      </PrintPage>

      <PrintPage v-if="hasPersonality" :number="pageNumber(personalityNumber)" title="Личность и история">
        <div class="details-grid">
          <section class="box portrait-box">
            <img v-if="avatar" :src="avatar" alt="Портрет персонажа" /><div v-else class="portrait-placeholder">Портрет</div>
            <dl><template v-for="field in appearanceFields" :key="field.label"><dt>{{ field.label }}</dt><dd>{{ field.value || '—' }}</dd></template></dl>
          </section>
          <div class="personality-column">
            <section v-for="field in personalityFields" :key="field.label" class="box text-box"><BoxTitle>{{ field.label }}</BoxTitle><RichContent :html="field.value" /></section>
          </div>
        </div>
        <section v-if="values.notes" class="box text-box notes-box"><BoxTitle>Заметки</BoxTitle><RichContent :html="String(values.notes)" /></section>
        <section v-if="values.person_backstory" class="box text-box backstory-box"><BoxTitle>Предыстория персонажа</BoxTitle><RichContent :html="String(values.person_backstory)" /></section>
      </PrintPage>

    </div>
  </main>
</template>

<script setup>
import { computed, defineComponent, h, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import PrintFeatureCard from '@/features/character-editor/components/print/PrintFeatureCard.vue'
import PrintPage from '@/features/character-editor/components/print/PrintPage.vue'
import PrintSpellCard from '@/features/character-editor/components/print/PrintSpellCard.vue'
import { RichContent } from '@sylvieshare/share-ui'
import { fetchGet } from '@/shared/api/http'
import { itemsApi } from '@/shared/api/itemsApi'
import { abilityModifier, proficiencyBonus, resolveNumValue, sumBonuses } from '@/shared/lib/dnd'
import { SAVE_ABBR, STAT_FULL, STAT_KEYS, STAT_SHORT, SUGGEST16_TO_STAT } from '@/shared/lib/dndStats'
import { normalizeValue } from '@/features/character-editor/blocks/dnd/lib/itemSection'
import { normalizeCounters } from '@/features/character-editor/blocks/dnd/lib/counterEntry'
import { formatHitDice, normalizeHitDice } from '@/features/character-editor/blocks/dnd/lib/hitDice'
import { dieLabel } from '@/shared/lib/systemDice'
import { useSuggestStore } from '@/stores/suggest'

const PrintField = defineComponent({
  props: { label: String, value: String },
  setup(props) { return () => h('div', { class: 'print-field' }, [h('strong', props.value || '—'), h('span', props.label)]) },
})
const MetricBox = defineComponent({
  props: { label: String, value: [String, Number] },
  setup(props) { return () => h('div', { class: 'metric-box' }, [h('strong', String(props.value ?? '—')), h('span', props.label)]) },
})
const BoxTitle = defineComponent({
  setup(_, { slots }) { return () => h('h2', { class: 'box-title' }, [h('span', '◆'), slots.default?.(), h('span', '◆')]) },
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
function plainLength(html) { return text(html).length }
function displayRef(value) { return text(value) }
function signed(value) { const n = Number(value) || 0; return `${n >= 0 ? '+' : ''}${n}` }
function pageNumber(value) { return String(value).padStart(2, '0') }

const characterName = computed(() => text(values.value.name) || 'Без имени')
const level = computed(() => Number(values.value.lvl?.level) || 1)
const classAndLevel = computed(() => {
  const names = (Array.isArray(values.value.classes) ? values.value.classes : []).map(entry => displayRef(entry)).filter(Boolean).join(' / ')
  return [names, level.value ? `${level.value} ур.` : ''].filter(Boolean).join(', ')
})
const avatar = computed(() => values.value.ava?.url || '')
function abilityScore(key) { return resolveNumValue(values.value[key]?.value) || 10 }
const storedProf = computed(() => values.value.prof_bonus || {})
const profBonus = computed(() => (storedProf.value.auto === false ? Number(storedProf.value.v) || 0 : proficiencyBonus(level.value)) + sumBonuses(storedProf.value.bonuses))
const abilities = computed(() => STAT_KEYS.map(key => {
  const score = abilityScore(key); const mod = abilityModifier(score); const saveProficient = !!values.value[key]?.save_up
  return { key, score, mod, short: STAT_SHORT[key], full: STAT_FULL[key], saveProficient, save: mod + (saveProficient ? profBonus.value : 0) + sumBonuses(values.value[key]?.save_bonuses) }
}))

const hp = computed(() => ({ current: 0, max: 0, temp: 0, ds_success: 0, ds_failure: 0, ...(values.value.hp || {}) }))
const armorClass = computed(() => { const armor = values.value.armor || {}; return (Number(armor.ac) || 0) + (armor.shield ? Number(armor.shield_bonus) || 0 : 0) + sumBonuses(armor.bonuses) })
const initiative = computed(() => {
  const data = values.value.initiative || {}
  return (Number(data.base) || 0) + sumBonuses(data.bonuses) + (data.use_dex === false ? 0 : abilityModifier(abilityScore('DEX')))
})
const speedLabel = computed(() => `${(Number(values.value.speed?.base) || 0) + sumBonuses(values.value.speed?.bonuses)} фт.`)
const hitDice = computed(() => formatHitDice(normalizeHitDice(hp.value)))

const SKILL_STAT = { 1: 'STR', 2: 'DEX', 3: 'DEX', 4: 'DEX', 5: 'INT', 6: 'INT', 7: 'INT', 8: 'INT', 9: 'INT', 10: 'WIS', 11: 'WIS', 12: 'WIS', 13: 'WIS', 14: 'WIS', 15: 'CHA', 16: 'CHA', 17: 'CHA', 18: 'CHA' }
const skills = computed(() => Object.entries(SKILL_STAT).map(([id, stat]) => {
  const stored = values.value[stat]?.skills?.[id] || {}; const rank = Number(stored.up) || 0
  return { id, name: stored.override_title || suggest.items(15).find(item => String(item.id) === id)?.value || '', rank, statShort: STAT_SHORT[stat], bonus: abilityModifier(abilityScore(stat)) + rank * profBonus.value + sumBonuses(stored.bonuses) }
}))
const passivePerception = computed(() => 10 + (skills.value.find(skill => skill.id === '10')?.bonus || 0))

function itemById(id) { return catalog.value[String(id)] || catalog.value[id] || null }
function diceLabel(id) { return dieLabel(id) }
function damageType(id) { return suggest.items(12).find(item => String(item.id) === String(id))?.value || '' }
function weaponProperties(item) {
  return (Array.isArray(item?.data?.tags) ? item.data.tags : []).map(tag => {
    if (tag && typeof tag === 'object') return text(tag)
    return suggest.items(14).find(entry => String(entry.id) === String(tag))?.value || String(tag ?? '')
  }).filter(Boolean).join(' · ')
}
function attackParts(entry, item) {
  const baseParts = (item?.data?.attacks || []).map(part => ({ ...part, diceKey: part.dice_id, typeKey: part.type }))
  const extraParts = (entry.add_attacks || []).map(part => ({ ...part, diceKey: part.dice_id, typeKey: part.type_suggest_id }))
  const result = [...baseParts, ...extraParts].map(part => [diceLabel(part.diceKey) ? `${Number(part.count) || 1}${diceLabel(part.diceKey)}` : '', damageType(part.typeKey)].filter(Boolean).join(' ')).filter(Boolean)
  const statKey = SUGGEST16_TO_STAT[Number(entry.stat_suggest_id)]; const flat = (statKey ? abilityModifier(abilityScore(statKey)) : 0) + (Number(entry.magic_up) || 0)
  if (flat && result.length) result[0] += ` ${signed(flat)}`
  return result.join(' + ')
}
const attacks = computed(() => (Array.isArray(values.value.weapon) ? values.value.weapon : []).slice(0, 8).map((entry, index) => {
  const item = itemById(entry.item_id); const statKey = SUGGEST16_TO_STAT[Number(entry.stat_suggest_id)]; const statMod = statKey ? abilityModifier(abilityScore(statKey)) : Number(vars.value.stats?.[String(entry.stat_suggest_id)]) || 0
  return { key: `${entry.item_id}-${index}`, name: item?.name || `Оружие #${entry.item_id || '—'}`, bonus: statMod + (Number(entry.magic_up) || 0) + (entry.proficient ? profBonus.value : 0), damage: attackParts(entry, item), properties: weaponProperties(item), description: entry.desc || '' }
}))
const attackBlankRows = computed(() => Math.max(0, 5 - attacks.value.length))
const proficiencyGroups = computed(() => Object.entries(values.value.proficiencies || {}).map(([name, value]) => ({ name, value: Array.isArray(value) ? value.map(text).filter(Boolean).join(', ') : text(value) })).filter(group => group.value))
const mainCanFitProficiencies = computed(() => {
  const contentLength = proficiencyGroups.value.reduce((sum, group) => sum + group.name.length + group.value.length, 0)
  return characterName.value.length <= 28 && classAndLevel.value.length <= 38 && contentLength <= 360
})
const mainProficiencyGroups = computed(() => mainCanFitProficiencies.value ? proficiencyGroups.value : [])
const equipmentProficiencyGroups = computed(() => mainCanFitProficiencies.value ? [] : proficiencyGroups.value)

const inventoryModel = computed(() => normalizeValue(values.value.items))
function inventoryEntry(entry) { return { ...entry, name: entry.override?.name || itemById(entry.id)?.name || (entry.id != null ? `Предмет #${entry.id}` : 'Предмет') } }
const inventorySections = computed(() => [
  { id: 'equipped', name: 'Экипировано', items: inventoryModel.value.equipped.map(inventoryEntry) },
  ...inventoryModel.value.sections.map(section => ({ ...section, items: section.items.map(inventoryEntry) })),
].filter(section => section.items.length))
const counters = computed(() => normalizeCounters(values.value.counters))
const coins = computed(() => Object.entries(values.value.money?.amounts || {}).filter(([, amount]) => Number(amount)).map(([id, amount]) => ({ id, amount: Number(amount), name: suggest.items(17).find(item => String(item.id) === id)?.value || `мон. ${id}` })))
const potions = computed(() => (Array.isArray(values.value.potions) ? values.value.potions : []).map(entry => ({ ...entry, count: Number(entry.count) || 1, name: entry.override?.name || itemById(entry.id)?.name || 'Зелье' })))
const hasEquipmentSide = computed(() => counters.value.length || coins.value.length || potions.value.length || equipmentProficiencyGroups.value.length)
const hasEquipment = computed(() => inventorySections.value.length || hasEquipmentSide.value)
const equipmentPages = computed(() => {
  if (!hasEquipment.value) return []
  const pages = []
  let page = { sections: [], weight: 0 }
  const limit = 39
  for (const section of inventorySections.value) {
    let chunk = null
    let sectionEntryIndex = 0
    for (const entry of section.items) {
      const entryWeight = Math.max(1, Math.ceil(entry.name.length / 48))
      const headingWeight = chunk ? 0 : 2
      if (page.weight + headingWeight + entryWeight > limit && page.sections.length) {
        pages.push(page)
        page = { sections: [], weight: 0 }
        chunk = null
      }
      if (!chunk) {
        const continued = sectionEntryIndex > 0
        chunk = {
          ...section,
          id: `${section.id}-${pages.length}-${page.sections.length}`,
          name: continued ? `${section.name} · продолжение` : section.name,
          items: [],
        }
        page.sections.push(chunk)
        page.weight += 2
      }
      chunk.items.push(entry)
      page.weight += entryWeight
      sectionEntryIndex += 1
    }
  }
  if (page.sections.length || !pages.length) pages.push(page)
  return pages
})

const rawSpells = computed(() => Array.isArray(values.value.spells?.spells) ? values.value.spells.spells : [])
const spellSlots = computed(() => (Array.isArray(values.value.spells?.slots) ? values.value.spells.slots : []).filter(slot => Number(slot.total) > 0))
const spellcasting = computed(() => {
  const data = values.value.spells || {}; const statKey = SUGGEST16_TO_STAT[Number(data.stat_path)]; const mod = statKey ? abilityModifier(abilityScore(statKey)) : 0
  return { stat: statKey ? STAT_FULL[statKey] : '—', saveDc: 8 + profBonus.value + mod + (Number(data.save_bonus) || 0), attackBonus: profBonus.value + mod + (Number(data.attack_bonus) || 0) }
})
function spellDice(rows) { return (Array.isArray(rows) ? rows : []).map(row => { const die = diceLabel(row.dice_id); const typeValue = damageType(row.type); return [die ? `${Number(row.count) || 1}${die}` : '', typeValue].filter(Boolean).join(' ') }).filter(Boolean).join(' + ') }
function spellCombatLine(item) {
  const data = item?.data || {}; const parts = []
  if (data.damage?.range_attack) parts.push('Атака заклинанием')
  if (data.damage?.save_ability) parts.push(`Спасбросок ${SAVE_ABBR[data.damage.save_ability] || String(data.damage.save_ability).toUpperCase()}${data.damage.save_effect === 'half' ? ' — половина урона' : ''}`)
  const damage = spellDice(data.damage?.dices); if (damage) parts.push(`Урон: ${damage}`)
  const heal = spellDice(data.heal?.dices); if (heal) parts.push(`Лечение: ${heal}`)
  return parts.join(' · ')
}
const spellCards = computed(() => rawSpells.value.map((entry, index) => {
  const item = itemById(entry.id); const data = item?.data || {}; const length = plainLength(data.description) + plainLength(data.upper)
  const span = length > 1150 ? 3 : length > 380 ? 2 : 1
  return { ...entry, id: `${entry.id}-${index}`, itemId: entry.id, name: item?.name || `Заклинание #${entry.id}`, level: Number(data.lvl ?? -1), data, school: suggest.items(7).find(s => String(s.id) === String(data.schoolId))?.value || '', source: (item?.contentSources || []).map(source => source.name || source.code).filter(Boolean).join(', '), combatLine: spellCombatLine(item), span, textLength: length }
}))
function estimatedCardHeight(card, columns) {
  const widthFactor = Math.max(1, Math.min(columns, card.span || 1)); const charsPerLine = columns === 3 ? 34 * widthFactor : 58 * widthFactor
  return 31 + Math.ceil(card.textLength / charsPerLine) * 3.15 + (card.combatLine ? 7 : 0) + (card.data?.upper ? 8 : 0)
}
function paginateGrid(cards, columns, firstCapacity, nextCapacity) {
  if (!cards.length) return [{ cards: [] }]
  const pages = []; let pageCards = []; let used = 0; let rowCols = 0; let rowHeight = 0; let capacity = firstCapacity
  const flushRow = () => { if (rowCols) { used += rowHeight + 4; rowCols = 0; rowHeight = 0 } }
  const flushPage = () => { flushRow(); pages.push({ cards: pageCards }); pageCards = []; used = 0; capacity = nextCapacity }
  for (const card of cards) {
    const span = Math.min(columns, card.span || 1); const height = estimatedCardHeight(card, columns)
    if (rowCols + span > columns) flushRow()
    if (used + height > capacity && pageCards.length) flushPage()
    pageCards.push(card); rowCols += span; rowHeight = Math.max(rowHeight, height)
    if (rowCols >= columns) flushRow()
  }
  if (pageCards.length) { flushRow(); pages.push({ cards: pageCards }) }
  return pages
}
const hasSpells = computed(() => rawSpells.value.length || spellSlots.value.length)
const spellPages = computed(() => hasSpells.value ? paginateGrid(spellCards.value, 3, spellSlots.value.length ? 190 : 222, 232) : [])

const appearanceFields = computed(() => [
  { label: 'Возраст', value: text(values.value.person_age) }, { label: 'Рост', value: text(values.value.person_height) }, { label: 'Вес', value: text(values.value.person_weight) },
  { label: 'Глаза', value: text(values.value.person_eyes) }, { label: 'Кожа', value: text(values.value.person_skin) }, { label: 'Волосы', value: text(values.value.person_hair) },
])
const personalityFields = computed(() => [
  { label: 'Черты характера', value: values.value.person_traits }, { label: 'Идеалы', value: values.value.person_ideals }, { label: 'Привязанности', value: values.value.person_bonds },
  { label: 'Слабости', value: values.value.person_flaws }, { label: 'Внешность', value: values.value.person_appearance }, { label: 'Союзники и организации', value: values.value.person_allies },
].filter(field => text(field.value)))
const hasPersonality = computed(() => avatar.value || appearanceFields.value.some(field => field.value) || personalityFields.value.length || text(values.value.notes) || text(values.value.person_backstory))
const featureCards = computed(() => [
  { group: 'Расовые особенности', value: values.value.abilities_race }, { group: 'Классовые особенности', value: values.value.abilities_class }, { group: 'Черты', value: values.value.abilities_feats },
].flatMap(group => (Array.isArray(group.value) ? group.value : []).map((entry, index) => {
  const item = itemById(entry.id); const description = item?.data?.description || ''; const length = plainLength(description)
  return { key: entry.uid || `${group.group}-${entry.id}-${index}`, group: group.group, name: item?.name || entry.name || `Особенность #${entry.id || '—'}`, description, countText: entry.max_use != null ? `${entry.count ?? entry.max_use} / ${entry.max_use}` : '', span: length > 700 ? 2 : 1, textLength: length }
})))
const featurePages = computed(() => featureCards.value.length ? paginateGrid(featureCards.value, 2, 230, 230) : [])

const featuresStart = computed(() => 2)
const equipmentStart = computed(() => featuresStart.value + featurePages.value.length)
const spellStart = computed(() => equipmentStart.value + equipmentPages.value.length)
const personalityNumber = computed(() => spellStart.value + spellPages.value.length)

function collectItemIds(data) {
  const ids = new Set(); const add = id => { if (id != null && id !== '') ids.add(id) }
  for (const entry of data.weapon || []) add(entry.item_id)
  const inv = normalizeValue(data.items); inv.equipped.forEach(entry => add(entry.id)); inv.sections.forEach(section => section.items.forEach(entry => add(entry.id)))
  ;(Array.isArray(data.potions) ? data.potions : []).forEach(entry => add(entry.id)); (data.spells?.spells || []).forEach(entry => add(entry.id))
  for (const key of ['abilities_race', 'abilities_class', 'abilities_feats']) (data[key] || []).forEach(entry => add(entry.id))
  return [...ids]
}
async function load() {
  loading.value = true; error.value = ''
  try {
    const res = await fetchGet('/char/' + route.params.uuid); if (!res?.data || res?.type) throw new Error(res?.desc || 'Персонаж не найден или недоступен.')
    response.value = res; const itemIds = collectItemIds(res.data?.values || {})
    const tasks = [7, 12, 14, 15, 17].map(id => suggest.ensure(id).catch(() => null))
    if (itemIds.length) tasks.push(itemsApi.byIds(itemIds).then(result => { catalog.value = Object.fromEntries((result?.items || []).map(item => [String(item.id), item])) }).catch(() => null))
    await Promise.all(tasks); document.title = `${characterName.value} — лист для печати`
  } catch (e) { error.value = e?.message || 'Произошла ошибка при загрузке.' } finally { loading.value = false }
}
function goBack() { router.push({ name: 'Character', params: { uuid: route.params.uuid } }) }
function printSheet() { window.print() }
onMounted(() => { document.documentElement.classList.add('character-print-mode'); window.scrollTo(0, 0); load() })
onBeforeUnmount(() => document.documentElement.classList.remove('character-print-mode'))
</script>

<style scoped>
.print-view { min-height: 100vh; padding: 28px 20px 64px; background: #e9e5dc; color: #201d19; color-scheme: light; font-family: Arial, Helvetica, sans-serif; }
.print-actions { width: min(210mm, 100%); margin: 0 auto 16px; display: flex; justify-content: space-between; gap: 12px; }
.action { min-height: 40px; display: inline-flex; align-items: center; justify-content: center; gap: 8px; padding: 0 15px; border: 1px solid #c8c1b5; border-radius: 8px; font: 600 13px/1 Arial, sans-serif; cursor: pointer; }
.action--quiet { background: #fffefa; color: #332e27; }.action--primary { background: #342d23; border-color: #342d23; color: #fffefa; }.action:disabled { opacity: .45; cursor: default; }
.paper-message { display: flex; flex-direction: column; align-items: center; gap: 8px; color: #756b5d; }.paper-message--error strong { color: #8e2929; }
.identity { display: grid; grid-template-columns: minmax(0, 1.05fr) minmax(0, 1.7fr); gap: 9mm; align-items: end; padding: 2mm 2mm 5mm; border-bottom: 1px solid #695a44; }
.overline { display: flex; align-items: center; gap: 2mm; margin-bottom: 2mm; font: 700 6px/1 Arial, sans-serif; letter-spacing: .18em; text-transform: uppercase; color: #8a7a61; }
.overline span { font-size: 5px; }.identity h1 { margin: 0; font: 700 29px/1.05 Georgia, serif; overflow-wrap: anywhere; }.write-line { margin-top: 2mm; border-bottom: .4px solid #baaa8d; }
.identity-fields, .spell-summary { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 4mm 6mm; }
:deep(.print-field) { min-width: 0; border-bottom: .5px solid #8d7d64; padding: 0 1mm 1.2mm; }:deep(.print-field strong) { display: block; min-height: 15px; font: 600 10px/1.2 Arial, sans-serif; overflow-wrap: anywhere; }:deep(.print-field span) { display: block; margin-top: 1mm; font-size: 5.5px; line-height: 1; letter-spacing: .09em; text-transform: uppercase; color: #756751; }
.main-grid { display: grid; grid-template-columns: 29mm minmax(0, 1fr) 52mm; gap: 3mm; align-items: start; margin-top: 4mm; min-width: 0; }
.stats-column, .center-column, .skills-column, .equipment-side, .personality-column { display: flex; flex-direction: column; gap: 3mm; min-width: 0; }
.ability-list { display: flex; flex-direction: column; gap: 2.2mm; }.ability-box { position: relative; min-height: 25mm; padding: 2.5mm 2mm 4mm; border: 1px solid #695a44; border-radius: 3.5mm; background: #fffefa; text-align: center; box-shadow: inset 0 0 0 .7mm #fffefa, inset 0 0 0 .9mm #c8baa0; }
.ability-name { font-size: 6px; font-weight: 800; letter-spacing: .08em; }.ability-mod { margin-top: 1.5mm; font: 700 20px/1 Georgia, serif; }.ability-score { position: absolute; left: 50%; bottom: -3.2mm; translate: -50% 0; min-width: 11mm; padding: 1.2mm 2mm; border: 1px solid #695a44; border-radius: 50%; background: #fffefa; font: 700 9px/1 Arial, sans-serif; }
.box { min-width: 0; border: 1px solid #695a44; padding: 3mm; background: rgba(255, 254, 250, .88); box-shadow: inset 0 0 0 .7mm #fffefa, inset 0 0 0 .9mm #c8baa0; break-inside: avoid; overflow: hidden; }
:deep(.box-title) { display: flex; align-items: center; justify-content: center; gap: 1.5mm; margin: 0 0 2.5mm; font: 800 6.5px/1.1 Arial, sans-serif; letter-spacing: .09em; text-align: center; text-transform: uppercase; }:deep(.box-title span) { color: #8a7a61; font-size: 4px; }
.line-row { display: grid; grid-template-columns: 3.5mm 7mm minmax(0, 1fr); align-items: center; gap: 1.2mm; min-height: 5mm; border-bottom: .35px solid #d5ccbc; font-size: 7px; }.line-row:last-child { border-bottom: 0; }.line-row strong { font-size: 8px; text-align: center; }.line-row > span:last-child { min-width: 0; overflow-wrap: anywhere; }.line-row small { color: #81725b; font-size: 5.5px; }
.prof-dot { width: 2.5mm; height: 2.5mm; border: .7px solid #4f4639; border-radius: 50%; }.prof-dot.filled { background: #4f4639; box-shadow: inset 0 0 0 .6mm #fffefa; }.prof-dot.expert { box-shadow: inset 0 0 0 .4mm #fffefa, inset 0 0 0 .85mm #4f4639; background: #fffefa; }
.combat-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 2mm; }:deep(.metric-box) { min-width: 0; min-height: 23mm; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1.5mm; padding: 2mm 1mm; border: 1px solid #695a44; border-radius: 4mm 4mm 1mm 1mm; text-align: center; box-shadow: inset 0 0 0 .6mm #fffefa, inset 0 0 0 .8mm #c8baa0; }:deep(.metric-box strong) { font: 700 18px/1 Georgia, serif; }:deep(.metric-box span) { max-width: 100%; font-size: 5px; font-weight: 800; line-height: 1.15; letter-spacing: .045em; text-transform: uppercase; overflow-wrap: anywhere; }
.hp-box { display: grid; grid-template-columns: 1fr 1fr; gap: 2mm; }.hp-box > div { display: flex; align-items: center; justify-content: center; gap: 2mm; text-align: center; }.hp-max { grid-column: 1 / -1; padding-bottom: 1.5mm; border-bottom: .5px solid #baaa8d; font-size: 7px; }.hp-max strong { font-size: 12px; }.hp-current, .hp-temp { min-height: 15mm; flex-direction: column; }.hp-current { border-right: .5px solid #baaa8d; }.hp-current strong, .hp-temp strong { font: 700 19px/1 Georgia, serif; }.hp-current span, .hp-temp span { font-size: 5px; font-weight: 800; text-transform: uppercase; }
.mini-grid { display: grid; grid-template-columns: .85fr 1.15fr; gap: 2mm; }.compact-box { min-height: 18mm; text-align: center; }.large-value { font: 700 12px/1 Georgia, serif; }.death-saves > div { display: flex; justify-content: flex-end; align-items: center; gap: 1mm; margin-top: 1.2mm; font-size: 5.5px; }.death-saves i, .slots-box i { width: 2.7mm; height: 2.7mm; display: inline-block; border: .7px solid #4f4639; border-radius: 50%; }.death-saves i.marked, .slots-box i.used { background: #4f4639; box-shadow: inset 0 0 0 .5mm #fffefa; }
table { width: 100%; border-collapse: collapse; table-layout: fixed; font-size: 6.8px; }th { padding: 1.2mm; border-bottom: .7px solid #695a44; color: #756751; font-size: 5px; letter-spacing: .06em; text-align: left; text-transform: uppercase; }td { height: 5.5mm; padding: 1mm 1.2mm; border-bottom: .35px solid #baaa8d; overflow-wrap: anywhere; }th:nth-child(2), td:nth-child(2) { width: 17%; text-align: center; }th:nth-child(3), td:nth-child(3) { width: 40%; }.attack-name { display: block; font-weight: 700; }.attack-properties { display: block; margin-top: .5mm; color: #756751; font-size: 5.2px; font-weight: 700; line-height: 1.25; }.attack-description-row td { height: auto; padding: .8mm 1.2mm 1.2mm; background: rgba(186, 170, 141, .08); color: #554b3d; text-align: left; }.attack-description-row :deep(.rc) { font: italic 5.8px/1.35 Georgia, serif; }.attack-description-row :deep(.rc > :first-child) { margin-top: 0; }.attack-description-row :deep(.rc > :last-child) { margin-bottom: 0; }
.passive-box { display: flex; align-items: center; gap: 2.2mm; }.passive-box strong { flex: 0 0 auto; width: 8mm; font: 700 13px/1 Georgia, serif; text-align: center; }.passive-box span { min-width: 0; font-size: 5px; font-weight: 800; line-height: 1.25; text-transform: uppercase; }.skills-box { padding-inline: 2.2mm; }.skills-box .line-row { grid-template-columns: 3mm 6.5mm minmax(0, 1fr); min-height: 4.7mm; }
.main-proficiencies { margin-top: 3mm; padding: 2.5mm 3mm; }.main-proficiencies :deep(.box-title) { margin-bottom: 2mm; }.main-proficiency-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 2mm 4mm; }.main-proficiency-grid .prose-group + .prose-group { margin-top: 0; }.main-proficiency-grid .prose-group { min-width: 0; }.main-proficiency-grid .prose-group p { font-size: 6.5px; line-height: 1.3; }
.equipment-grid { display: grid; grid-template-columns: minmax(0, 1fr) 59mm; gap: 5mm; align-items: start; min-width: 0; }.equipment-grid--full { grid-template-columns: 1fr; }.inventory-section + .inventory-section { margin-top: 4mm; }.inventory-section h3, .prose-group h3 { margin: 0 0 1.2mm; font: 700 6px/1 Arial, sans-serif; letter-spacing: .08em; text-transform: uppercase; color: #756751; }.inventory-row, .list-box > div { display: flex; justify-content: space-between; gap: 4mm; min-height: 6mm; padding: 1.2mm 0; border-bottom: .35px solid #baaa8d; font-size: 8px; }.inventory-row span, .list-box span { min-width: 0; overflow-wrap: anywhere; }.inventory-row strong, .list-box strong { flex: 0 0 auto; white-space: nowrap; }
.coins-box { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 2mm; }.coins-box :deep(.box-title) { grid-column: 1 / -1; }.coins-box > div { min-width: 0; text-align: center; }.coins-box strong { display: block; font: 700 13px/1 Georgia, serif; }.coins-box > div > span { display: block; margin-top: 1mm; font-size: 5px; text-transform: uppercase; overflow-wrap: anywhere; }.prose-group + .prose-group { margin-top: 2.5mm; }.prose-group p { margin: 0; font: 7px/1.4 Georgia, serif; overflow-wrap: anywhere; }.empty-state { padding: 12mm 0; color: #8a7a61; font: italic 9px Georgia, serif; text-align: center; }
.spell-summary { grid-template-columns: repeat(3, minmax(0, 1fr)); margin-bottom: 4mm; }.slots-box { display: flex; align-items: flex-start; flex-wrap: wrap; gap: 2.5mm 6mm; margin-bottom: 4mm; }.slots-box :deep(.box-title) { width: 100%; justify-content: flex-start; }.slots-box > div { display: flex; align-items: center; gap: .8mm; font-size: 7px; }.slots-box > div > span { min-width: 11mm; font-weight: 700; }.spell-card-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); grid-auto-flow: row dense; gap: 3mm; align-items: start; min-width: 0; }
.details-grid { display: grid; grid-template-columns: 54mm minmax(0, 1fr); gap: 5mm; align-items: start; }.portrait-box img, .portrait-placeholder { width: 100%; aspect-ratio: 4 / 5; object-fit: cover; filter: grayscale(1); border: .5px solid #baaa8d; }.portrait-placeholder { display: grid; place-items: center; color: #a09177; font: italic 10px Georgia, serif; }.portrait-box dl { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 1.5mm 3mm; margin: 4mm 0 0; }.portrait-box dt { font-size: 5px; font-weight: 800; text-transform: uppercase; color: #756751; }.portrait-box dd { min-width: 0; margin: 0; border-bottom: .35px solid #baaa8d; font: 7px Georgia, serif; overflow-wrap: anywhere; }.text-box { min-height: 20mm; }.text-box :deep(.rc) { color: #332e27; font: 8px/1.48 Georgia, serif; }.notes-box, .backstory-box { margin-top: 4mm; }.feature-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); grid-auto-flow: row dense; gap: 4mm; align-items: start; min-width: 0; }

@media (max-width: 760px) { .print-view { padding: 14px 0 40px; overflow-x: auto; }.print-actions { width: 210mm; padding: 0 12px; } }
@media print {
  @page { size: A4 portrait; margin: 0; }
  .print-view { min-height: 0; padding: 0; background: #fff; }.print-actions { display: none !important; }.print-document { width: 210mm; }.box, .ability-box, .identity { break-inside: avoid; }* { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
}
</style>

<style>
html.character-print-mode, html.character-print-mode body, html.character-print-mode #app, html.character-print-mode .page-transition-stage--print { background: #e9e5dc !important; color-scheme: light; }
html.character-print-mode body { overflow-x: auto; }
@media print { html.character-print-mode, html.character-print-mode body, html.character-print-mode #app, html.character-print-mode .page-transition-stage, html.character-print-mode .page-transition-stage--print { background: #fff !important; }html.character-print-mode body { overflow: visible; } }
</style>
