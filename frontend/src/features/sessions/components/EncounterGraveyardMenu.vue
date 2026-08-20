<template>
  <button
    ref="trigger"
    type="button"
    class="enc-graveyard-trigger"
    :class="{ 'enc-graveyard-trigger--active': open }"
    title="Открыть кладбище"
    aria-label="Кладбище погибших существ"
    @click="open = !open"
  >
    <Bone :size="18" />
    <span class="enc-graveyard-trigger-label">Кладбище</span>
    <span v-if="deadItems.length" class="enc-graveyard-count">{{ deadItems.length }}</span>
  </button>

  <BasePopover
    v-model:open="open"
    :anchor="trigger"
    placement="bottom-end"
    :min-width="340"
    popover-class="enc-graveyard-popover"
  >
    <div class="enc-graveyard-menu">
      <div class="enc-graveyard-head">
        <div>
          <span>Погибшие</span>
          <small>{{ deadItems.length ? `${deadItems.length} в списке` : 'Список пуст' }}</small>
        </div>
        <button
          v-if="isDm"
          type="button"
          class="enc-graveyard-clear"
          :disabled="deadNpcCount === 0"
          title="Удалить всех погибших существ"
          @click="confirmDeleteDead = true"
        >
          <Trash2 :size="15" />
          Удалить всех
        </button>
      </div>

      <div v-if="deadItems.length" class="enc-graveyard-list">
        <div v-for="combatant in deadItems" :key="combatant.uid" class="enc-graveyard-entry">
          <button
            type="button"
            class="enc-graveyard-creature"
            :class="{ 'enc-graveyard-creature--open': selectedUid === combatant.uid }"
            @click="toggleActions(combatant)"
          >
            <span class="enc-graveyard-skull"><Skull :size="15" /></span>
            <span class="enc-graveyard-creature-copy">
              <strong>{{ combatantName(combatant) }}</strong>
              <small>{{ combatantSummary(combatant) }}</small>
            </span>
            <ChevronRight :size="16" class="enc-graveyard-chevron" />
          </button>
          <div v-if="selectedUid === combatant.uid" class="enc-graveyard-actions">
            <button type="button" @click="viewCombatant(combatant)">
              <Eye :size="15" />Посмотреть
            </button>
            <button v-if="isDm" type="button" class="enc-graveyard-action--restore" @click="restoreCombatant(combatant)">
              <RotateCcw :size="15" />Вернуть
            </button>
            <button v-if="isDm && combatant.type === 'npc'" type="button" class="enc-graveyard-action--delete" @click="deleteCombatant(combatant)">
              <Trash2 :size="15" />Удалить
            </button>
          </div>
        </div>
      </div>
      <div v-else class="enc-graveyard-empty">
        <Skull :size="22" />
        <span>Здесь появятся погибшие существа</span>
      </div>
    </div>
  </BasePopover>

  <AppModalFrame v-if="preview" :title="combatantName(preview)" @close="preview = null">
    <div class="enc-dead-preview-stats">
      <span>КБ <strong>{{ enc.displayAc(preview) ?? '—' }}</strong></span>
      <span>HP <strong>{{ preview.hpCurrent ?? 0 }} / {{ enc.npcHpMax(preview) || '—' }}</strong></span>
    </div>
    <p v-if="preview.override?.description" class="enc-dead-preview-description">
      {{ preview.override.description }}
    </p>
    <p v-else class="enc-dead-preview-description enc-dead-preview-description--empty">
      У существа нет дополнительного описания.
    </p>
  </AppModalFrame>

  <ConfirmDialog
    v-if="confirmDeleteDead"
    title="Удалить всех погибших?"
    :message="`Будут удалены все погибшие существа (${deadNpcCount}). Это действие нельзя отменить.`"
    confirm-label="Удалить всех"
    @cancel="confirmDeleteDead = false"
    @confirm="deleteAllDead"
  />
</template>

<script setup>
import { computed, inject, ref } from 'vue'
import { Bone, ChevronRight, Eye, RotateCcw, Skull, Trash2 } from '@lucide/vue'
import { AppModalFrame } from '@sylvieshare/share-ui'
import { BasePopover } from '@sylvieshare/share-ui'
import { ConfirmDialog } from '@sylvieshare/share-ui'

defineProps({
  isDm: { type: Boolean, default: false },
})
const emit = defineEmits(['view-participant'])

const enc = inject('encounter')
const trigger = ref(null)
const open = ref(false)
const selectedUid = ref(null)
const preview = ref(null)
const confirmDeleteDead = ref(false)

const deadItems = computed(() => enc.sortable.displayItems('dead'))
const deadNpcCount = computed(() => deadItems.value.filter(combatant => combatant.type === 'npc').length)

function combatantName(combatant) {
  return combatant.type === 'player'
    ? enc.playerDisplayName(combatant)
    : enc.npcName(combatant)
}

function combatantSummary(combatant) {
  const ac = enc.displayAc(combatant)
  if (combatant.type === 'player') return `Игрок · КБ ${ac ?? '—'}`
  return `Существо · КБ ${ac ?? '—'} · HP ${combatant.hpCurrent ?? 0}`
}

function toggleActions(combatant) {
  selectedUid.value = selectedUid.value === combatant.uid ? null : combatant.uid
}

function viewCombatant(combatant) {
  open.value = false
  if (combatant.type === 'player') emit('view-participant', combatant.charId)
  else if (combatant.itemId != null) enc.openNpcDetail(combatant)
  else preview.value = combatant
}

function restoreCombatant(combatant) {
  enc.reviveCombatant(combatant)
  selectedUid.value = null
}

function deleteCombatant(combatant) {
  enc.removeNpc(combatant)
  selectedUid.value = null
}

function deleteAllDead() {
  enc.removeAllDeadNpcs()
  selectedUid.value = null
  confirmDeleteDead.value = false
  open.value = false
}
</script>

<style scoped src="./styles/EncounterGraveyardMenu.css"></style>
