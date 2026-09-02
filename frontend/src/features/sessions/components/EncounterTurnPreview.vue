<template>
  <aside class="turn-preview" aria-label="Текущий ход">
    <div class="turn-preview-eyebrow">
      <span class="turn-preview-pulse" />
      Сейчас ходит
    </div>

    <div v-if="!combatant" class="turn-preview-empty">
      <Hourglass :size="30" :stroke-width="1.4" />
      <strong>Нет активного участника</strong>
      <span>Добавьте участников на сцену или перейдите к следующему ходу.</span>
    </div>

    <template v-else>
      <header class="turn-preview-hero" :style="accentStyle">
        <EncounterAvatar :combatant="combatant" />
        <div class="turn-preview-identity" aria-live="polite">
          <span>{{ kindLabel }}</span>
          <strong>{{ displayName }}</strong>
          <small v-if="subtitle">{{ subtitle }}</small>
        </div>
        <span v-if="isNpc" class="turn-preview-side" :class="enc.badgeClass(combatant)">
          {{ enc.badgeLabel(combatant) }}
        </span>
      </header>

      <div class="turn-preview-live">
        <div class="turn-preview-stat">
          <span>Инициатива</span>
          <strong>{{ combatant.initiative ?? '—' }}</strong>
        </div>
        <div class="turn-preview-stat">
          <span>Класс доспеха</span>
          <strong>{{ enc.displayAc(combatant) }}</strong>
        </div>
        <EncounterHpBar class="turn-preview-hp" :combatant="combatant" section="combat" />
      </div>

      <div v-if="stateItems.length" class="turn-preview-states">
        <span v-for="item in stateItems" :key="item.id">{{ item.name }}</span>
      </div>

      <template v-if="isReferenceNpc">
        <div class="turn-preview-section-title">Справка по существу</div>
        <div v-if="abilities.length" class="turn-preview-abilities">
          <div v-for="ability in abilities" :key="ability.key">
            <span>{{ ability.label }}</span>
            <strong>{{ ability.value }}</strong>
            <small>{{ ability.modifier }}</small>
          </div>
        </div>
        <EnemyDetailContent
          class="turn-preview-reference"
          :item="npcItem"
          :type="bestiaryType"
          :actor-name="enc.npcActorName(combatant)"
          :show-title="false"
        />
      </template>

      <template v-else-if="isPlayer">
        <div class="turn-preview-section-title">Боевой профиль</div>
        <p class="turn-preview-description">
          Здесь остаются только данные, нужные во время хода. Полный лист открывается отдельно и не перегружает боевую сцену.
        </p>
        <button
          type="button"
          class="turn-preview-open"
          :disabled="!participant"
          @click="participant && emit('view-participant', participant)"
        >
          <UserRoundSearch :size="17" />
          Открыть лист персонажа
        </button>
      </template>

      <template v-else>
        <div class="turn-preview-section-title">Упрощённое существо</div>
        <p class="turn-preview-description">
          {{ combatant.override?.description || 'Дополнительное описание не задано.' }}
        </p>
      </template>
    </template>
  </aside>
</template>

<script setup>
import { computed, inject, onMounted } from 'vue'
import { Hourglass, UserRoundSearch } from '@lucide/vue'
import EnemyDetailContent from '@/features/items/detail-components/EnemyDetailContent.vue'
import EncounterAvatar from '@/features/sessions/components/EncounterAvatar.vue'
import EncounterHpBar from '@/features/sessions/components/EncounterHpBar.vue'
import { useItemReferenceMap } from '@/features/sessions/composables/useItemReferenceMap'
import { abilityModifier } from '@/shared/lib/dnd'
import { useItemTypesStore } from '@/stores/itemTypes'

const props = defineProps({
  combatant: { type: Object, default: null },
})
const emit = defineEmits(['view-participant'])

const enc = inject('encounter')
const itemTypesStore = useItemTypesStore()

onMounted(() => itemTypesStore.ensureType(6).catch(() => null))

const isPlayer = computed(() => props.combatant?.type === 'player')
const isNpc = computed(() => props.combatant?.type === 'npc')
const npcItem = computed(() => isNpc.value ? enc.npcItem(props.combatant) : null)
const isReferenceNpc = computed(() => !!npcItem.value)
const participant = computed(() => isPlayer.value ? enc.findParticipant(props.combatant.charId) : null)
const bestiaryType = computed(() => itemTypesStore.getType(6) || { id: 6, fields: [] })

const displayName = computed(() => {
  if (!props.combatant) return ''
  return isPlayer.value
    ? enc.playerDisplayName(props.combatant)
    : enc.npcActorName(props.combatant)
})
const subtitle = computed(() => props.combatant ? enc.subtitle(props.combatant) : '')
const kindLabel = computed(() => {
  if (isPlayer.value) return 'Персонаж игрока'
  return isReferenceNpc.value ? 'Существо из бестиария' : 'Упрощённое существо'
})
const accentStyle = computed(() => {
  if (!props.combatant) return null
  const color = enc.tileColor(props.combatant) || enc.avatarStyle(props.combatant)?.color
  return color ? { '--turn-preview-accent': color } : null
})

const statesValue = computed(() => props.combatant ? enc.statesValue(props.combatant) : [])
const { itemById: stateItemById } = useItemReferenceMap(statesValue)
const stateItems = computed(() => statesValue.value.map(stateItemById).filter(Boolean))

const ABILITIES = [
  ['str', 'СИЛ'],
  ['dex', 'ЛОВ'],
  ['con', 'ТЕЛ'],
  ['int', 'ИНТ'],
  ['wis', 'МДР'],
  ['cha', 'ХАР'],
]
const abilities = computed(() => {
  const stats = npcItem.value?.data?.stats || {}
  return ABILITIES.map(([key, label]) => {
    const value = Number(stats[key])
    const valid = Number.isFinite(value)
    const modifier = valid ? abilityModifier(value) : null
    return {
      key,
      label,
      value: valid ? value : '—',
      modifier: modifier == null ? '—' : modifier >= 0 ? `+${modifier}` : String(modifier),
    }
  })
})
</script>

<style scoped>
.turn-preview {
  --turn-preview-accent: var(--accent);
  position: sticky;
  top: 0;
  min-width: 0;
  max-height: calc(100vh - var(--header-h) - var(--session-workspace-content-top, 172px) - 28px);
  box-sizing: border-box;
  overflow: auto;
  border: 1px solid var(--border);
  border-radius: 14px;
  background: color-mix(in srgb, var(--surface) 94%, transparent);
  box-shadow: var(--shadow-sm);
  scrollbar-gutter: stable;
}

.turn-preview-eyebrow {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 13px 16px;
  border-bottom: 1px solid var(--border);
  color: var(--text-muted);
  font-size: 10px;
  font-weight: 850;
  letter-spacing: .1em;
  text-transform: uppercase;
}

.turn-preview-pulse {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--danger);
  box-shadow: 0 0 9px color-mix(in srgb, var(--danger) 65%, transparent);
}

.turn-preview-empty {
  min-height: 260px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 8px;
  padding: 28px;
  color: var(--text-muted);
  text-align: center;
}
.turn-preview-empty strong { color: var(--text-1); font-size: 14px; }
.turn-preview-empty span { max-width: 280px; font-size: 12px; line-height: 1.5; }

.turn-preview-hero {
  position: relative;
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 14px;
  padding: 18px 16px;
  border-bottom: 1px solid color-mix(in srgb, var(--turn-preview-accent) 32%, var(--border));
  background:
    radial-gradient(circle at 8% 0%, color-mix(in srgb, var(--turn-preview-accent) 18%, transparent), transparent 52%),
    var(--surface-raised);
}
.turn-preview-hero :deep(.enc-avatar) { width: 78px; height: 78px; flex: 0 0 78px; }

.turn-preview-identity { min-width: 0; display: flex; flex-direction: column; gap: 3px; padding-right: 44px; }
.turn-preview-identity > span { color: var(--text-muted); font-size: 9px; font-weight: 800; letter-spacing: .07em; text-transform: uppercase; }
.turn-preview-identity strong { overflow: hidden; color: var(--text-1); font-size: 19px; line-height: 1.15; text-overflow: ellipsis; white-space: nowrap; }
.turn-preview-identity small { overflow: hidden; color: var(--text-2); font-size: 11px; text-overflow: ellipsis; white-space: nowrap; }

.turn-preview-side { position: absolute; top: 12px; right: 12px; font-size: 8px; font-weight: 850; letter-spacing: .07em; }
.turn-preview-side.badge--enemy { color: var(--side-enemy); }
.turn-preview-side.badge--ally { color: var(--success); }
.turn-preview-side.badge--neutral { color: var(--side-neutral); }
.turn-preview-side.badge--minion { color: var(--side-minion); }

.turn-preview-live {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border);
}
.turn-preview-stat { display: flex; flex-direction: column; gap: 2px; padding: 7px 9px; border: 1px solid var(--border); border-radius: 9px; background: var(--surface-raised); }
.turn-preview-stat span { color: var(--text-muted); font-size: 8px; font-weight: 750; letter-spacing: .04em; text-transform: uppercase; }
.turn-preview-stat strong { color: var(--text-1); font-size: 18px; line-height: 1; }
.turn-preview-hp { grid-column: 1 / -1; align-self: center; padding: 4px 2px 0; }

.turn-preview-states { display: flex; flex-wrap: wrap; gap: 5px; padding: 10px 16px 0; }
.turn-preview-states span { padding: 4px 7px; border: 1px solid color-mix(in srgb, var(--warning) 38%, var(--border)); border-radius: 999px; background: color-mix(in srgb, var(--warning) 10%, transparent); color: var(--warning); font-size: 9px; font-weight: 750; }

.turn-preview-section-title { padding: 16px 16px 9px; color: var(--text-muted); font-size: 9px; font-weight: 850; letter-spacing: .09em; text-transform: uppercase; }
.turn-preview-abilities { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 4px; padding: 0 16px 14px; }
.turn-preview-abilities > div { display: flex; flex-direction: column; align-items: center; gap: 1px; padding: 6px 2px; border: 1px solid var(--border); border-radius: 8px; background: var(--surface-raised); }
.turn-preview-abilities span { color: var(--text-muted); font-size: 8px; font-weight: 800; }
.turn-preview-abilities strong { color: var(--text-1); font-size: 13px; }
.turn-preview-abilities small { color: var(--accent-soft); font-size: 9px; font-weight: 750; }

.turn-preview-reference { padding: 0 16px 18px; }
.turn-preview-description { margin: 0; padding: 0 16px 14px; color: var(--text-2); font-size: 12px; line-height: 1.55; white-space: pre-wrap; }
.turn-preview-open {
  min-height: 38px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  margin: 0 16px 18px;
  padding: 0 13px;
  border: 1px solid color-mix(in srgb, var(--accent) 46%, var(--border));
  border-radius: 9px;
  background: color-mix(in srgb, var(--accent) 11%, transparent);
  color: var(--accent-soft);
  font: inherit;
  font-size: 12px;
  font-weight: 750;
  cursor: pointer;
}
.turn-preview-open:hover:not(:disabled) { border-color: var(--accent); background: color-mix(in srgb, var(--accent) 18%, transparent); color: var(--text-1); }
.turn-preview-open:disabled { cursor: not-allowed; opacity: .4; }
</style>
