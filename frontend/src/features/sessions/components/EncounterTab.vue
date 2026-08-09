<template>
  <div class="enc-wrap">

    <!-- ── Top toolbar ── -->
    <div class="enc-toolbar">
      <div class="enc-toolbar-left">
        <button
          class="enc-combat-btn"
          :class="enc.encounter.active ? 'enc-combat-btn--end' : 'enc-combat-btn--start'"
          :disabled="!enc.encounter.active && totalSelected === 0"
          @click="enc.toggleCombat"
        >
          <template v-if="enc.encounter.active">Закончить бой</template>
          <template v-else>
            Начать бой
            <span class="enc-combat-btn-count">({{ totalSelected }})</span>
          </template>
        </button>
        <template v-if="enc.encounter.active">
          <div class="enc-round-wrap">
            <span class="enc-round-label">Раунд</span>
            <span class="enc-round-num">{{ enc.encounter.round }}</span>
          </div>
          <button class="enc-turn-btn" :disabled="enc.inCombat.length === 0" @click="enc.prevTurn">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M8 2L3 6l5 4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            Пред
          </button>
          <button class="enc-turn-btn enc-turn-btn--next" :disabled="enc.inCombat.length === 0" @click="enc.nextTurn">
            След
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M4 2l5 4-5 4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
        </template>
      </div>
      <div class="enc-toolbar-right">
        <button
          v-if="props.isDm"
          type="button"
          class="enc-tool-btn"
          :disabled="enc.selectedRerollCount === 0"
          title="Перебросить инициативу выбранным"
          @click="enc.rerollSelectedInitiative"
        >Перебросить инициативу<span v-if="enc.selectedRerollCount > 0" class="enc-tool-btn-count">({{ enc.selectedRerollCount }})</span></button>
        <button
          v-if="props.isDm"
          type="button"
          class="enc-tool-btn enc-tool-btn--danger"
          :disabled="enc.selectedNpcCount === 0"
          title="Удалить выбранных НПС"
          @click="enc.removeSelectedNpcs"
        >Удалить НПС<span v-if="enc.selectedNpcCount > 0" class="enc-tool-btn-count">({{ enc.selectedNpcCount }})</span></button>
      </div>
    </div>

    <!-- ── Combat ── -->
    <div class="enc-block enc-block--combat">
      <div class="enc-section-title-row">
        <span class="enc-section-title">
          <span class="enc-section-dot" />БОЕВАЯ СЦЕНА
          <span v-if="enc.encounter.active" class="enc-status enc-status--live">БОЙ ИДЁТ</span>
          <span v-else class="enc-status enc-status--idle">НЕ В БОЕ</span>
        </span>
        <button
          v-if="enc.encounter.active"
          type="button"
          class="enc-select-btn"
          :disabled="combatItems.length === 0"
          @click="enc.selectAllInGroup('combat')"
        >{{ allSelectedInCombat ? 'Сбросить' : 'Выбрать всех' }}</button>
        <button
          v-if="enc.encounter.active"
          type="button"
          class="enc-send-btn"
          :disabled="combatMoveCount === 0 || !props.isDm"
          title="Отправить выбранных в сцену"
          @click="enc.sendSelectedTo('combat')"
        >На сцену ({{ combatMoveCount }})</button>
      </div>
      <div class="enc-section">
        <div
          v-if="combatItems.length === 0"
          class="enc-empty"
          data-sortable-container="combat"
        >
          {{ enc.encounter.active
              ? 'Переместите участников из запаса в бой'
              : 'Боевая сцена пуста — выберите участников и нажмите «Начать бой»' }}
        </div>
        <div
          v-else
          class="enc-rows"
          data-sortable-container="combat"
        >
          <EncounterRow
            v-for="(c, idx) in combatItems"
            :key="c.uid"
            :combatant="c"
            section="combat"
            :idx="idx"
            :is-current="enc.encounter.active && c.uid === currentTurnUid"
          />
        </div>
      </div>
    </div>

    <!-- ── NPC reserve ── -->
    <div class="enc-block enc-block--npc" :class="{ 'enc-block--disabled': enc.npcReserveCollapsed }">
      <div class="enc-section-title-row">
        <span class="enc-section-title">
          <span class="enc-section-dot" />ЗАПАС НПС<span v-if="enc.npcReserveCollapsed" class="enc-section-disabled-hint"> · недоступно для игроков</span>
        </span>
        <button
          type="button"
          class="enc-select-btn"
          :disabled="npcItems.length === 0"
          @click="enc.selectAllInGroup('reserve-npc')"
        >{{ allSelectedInNpcs ? 'Сбросить' : 'Выбрать всех' }}</button>
        <button
          type="button"
          class="enc-send-btn"
          :disabled="npcMoveCount === 0 || !props.isDm"
          title="Отправить выбранных НПС в запас"
          @click="enc.sendSelectedTo('reserve-npc')"
        >В запас ({{ npcMoveCount }})</button>
      </div>
      <div class="enc-section">
        <div
          v-if="npcItems.length"
          class="enc-reserve-list"
          data-sortable-container="reserve-npc"
        >
          <EncounterRow
            v-for="c in npcItems"
            :key="c.uid"
            :combatant="c"
            section="reserve-npc"
          />
        </div>
        <div
          v-else-if="!enc.npcReserveCollapsed"
          class="enc-reserve-empty"
          data-sortable-container="reserve-npc"
        >Запас пуст</div>
        <div class="enc-add-row">
          <button class="enc-add-dashed" @click="enc.showNpcPicker = true">+ Добавить из бестиария</button>
          <button class="enc-add-dashed enc-add-dashed--simple" @click="enc.showSimpleForm = true">+ Создать упрощённо</button>
        </div>
      </div>
    </div>

    <!-- ── Players reserve ── -->
    <div class="enc-block enc-block--players">
      <div class="enc-section-title-row">
        <span class="enc-section-title">
          <span class="enc-section-dot" />ЗАПАС ИГРОКОВ
        </span>
        <button
          type="button"
          class="enc-select-btn"
          :disabled="playerItems.length === 0"
          @click="enc.selectAllInGroup('reserve-player')"
        >{{ allSelectedInPlayers ? 'Сбросить' : 'Выбрать всех' }}</button>
        <button
          type="button"
          class="enc-send-btn"
          :disabled="playerMoveCount === 0 || !props.isDm"
          title="Отправить выбранных игроков в запас"
          @click="enc.sendSelectedTo('reserve-player')"
        >В запас ({{ playerMoveCount }})</button>
      </div>
      <div class="enc-section">
        <div
          v-if="playerItems.length === 0"
          class="enc-reserve-empty"
          data-sortable-container="reserve-player"
        >Все игроки в бою</div>
        <div
          v-else
          class="enc-reserve-list"
          data-sortable-container="reserve-player"
        >
          <EncounterRow
            v-for="c in playerItems"
            :key="c.uid"
            :combatant="c"
            section="reserve-player"
          />
        </div>
      </div>
    </div>

    <!-- ── Dead zone ── -->
    <div class="enc-block enc-block--dead">
      <div class="enc-section-title-row">
        <span class="enc-section-title enc-section-title--dead">
          <span class="enc-section-dot" />💀 КЛАДБИЩЕ
        </span>
        <button
          type="button"
          class="enc-select-btn"
          :disabled="deadItems.length === 0"
          @click="enc.selectAllInGroup('dead')"
        >{{ allSelectedInDead ? 'Сбросить' : 'Выбрать всех' }}</button>
        <button
          type="button"
          class="enc-send-btn"
          :disabled="deadMoveCount === 0 || !props.isDm"
          title="Отправить выбранных на кладбище"
          @click="enc.sendSelectedTo('dead')"
        >На кладбище ({{ deadMoveCount }})</button>
      </div>
      <div class="enc-section">
        <div
          v-if="deadItems.length === 0"
          class="enc-reserve-empty"
          data-sortable-container="dead"
        >Никто не пал</div>
        <div
          v-else
          class="enc-reserve-list"
          data-sortable-container="dead"
        >
          <EncounterRow
            v-for="c in deadItems"
            :key="c.uid"
            :combatant="c"
            section="dead"
          />
        </div>
      </div>
    </div>

    <ItemPickerModal
      v-if="enc.showNpcPicker"
      :item-type-ids="[6]"
      title="Бестиарий"
      search-placeholder="Поиск существ..."
      allow-quantity
      create-show-name-en
      @close="enc.showNpcPicker = false"
      @pick="enc.addNpc"
    />

    <AppModal v-if="enc.showSimpleForm" @close="enc.showSimpleForm = false">
      <div class="hp-edit-title">Своё существо</div>
      <FormField label="Имя" vertical>
        <FormTextInput v-model:value="simpleForm.name" placeholder="Гоблин-вожак" autofocus @enter="submitSimple" />
      </FormField>
      <div class="simple-grid">
        <FormField label="Класс брони" vertical>
          <FormNumberInput :value="simpleForm.ac" :min="0" :max="99" @change="simpleForm.ac = $event" />
        </FormField>
        <FormField label="Текущие HP" vertical>
          <FormNumberInput :value="simpleForm.hp" :min="0" :max="9999" @change="onSimpleHp" />
        </FormField>
        <FormField label="Максимум HP" vertical>
          <FormNumberInput :value="simpleForm.hpMax" :min="0" :max="9999" @change="simpleForm.hpMax = $event" />
        </FormField>
      </div>
      <FormField label="Описание" vertical>
        <FormTextarea v-model:value="simpleForm.description" :rows="3" :maxlength="2000" placeholder="Краткое описание" />
      </FormField>
      <FormActionButtons
        submit-text="Добавить"
        :can-submit="!!simpleForm.name.trim()"
        @cancel="enc.showSimpleForm = false"
        @submit="submitSimple"
      />
    </AppModal>
    <DndHpCalcModal
      v-if="enc.hpCalcNpc"
      :hp="enc.npcHpObj(enc.hpCalcNpc)"
      :dice-options="[]"
      is-npc
      @close="enc.closeHpCalc"
      @change="enc.onNpcHpChange"
      @graveyard="onNpcGraveyard"
    />
    <DndHpCalcModal
      v-if="enc.hpCalcPlayer"
      :hp="enc.playerHpObj(enc.hpCalcPlayer)"
      :dice-options="[]"
      @close="enc.closeHpCalcPlayer"
      @change="enc.onPlayerHpChange"
    />

    <ItemViewModal
      v-if="enc.detailNpc && enc.detailNpc.itemId != null"
      :item-type-id="6"
      :item-id="enc.detailNpc.itemId"
      :item="enc.npcItem(enc.detailNpc) ?? null"
      @close="enc.closeNpcDetail"
    />

    <AppModal v-if="enc.hpEditNpc" @close="enc.closeNpcHpEdit">
      <div class="hp-edit-title">{{ enc.npcName(enc.hpEditNpc) }} · хиты</div>
      <FormField label="Текущие HP">
        <FormNumberInput :value="enc.hpEditNpc.hpCurrent ?? 0" :min="0" :max="999" @change="enc.setNpcHpField('current', $event)" />
      </FormField>
      <FormField label="Максимум HP">
        <FormNumberInput :value="enc.npcHpMax(enc.hpEditNpc)" :min="0" :max="999" @change="enc.setNpcHpField('max', $event)" />
      </FormField>
      <FormField label="Временные HP">
        <FormNumberInput :value="enc.hpEditNpc.hpTemp ?? 0" :min="0" :max="999" @change="enc.setNpcHpField('temp', $event)" />
      </FormField>
    </AppModal>
  </div>
</template>

<script setup>
import { computed, provide, reactive, toRef } from 'vue'
import AppModal from '@/shared/ui/AppModal'
import DndHpCalcModal from '@/features/character-editor/blocks/dnd/DndHpCalcModal'
import EncounterRow from '@/features/sessions/components/EncounterRow'
import FormActionButtons from '@/shared/ui/form/FormActionButtons'
import FormField from '@/shared/ui/form/FormField'
import FormNumberInput from '@/shared/ui/form/FormNumberInput'
import FormTextInput from '@/shared/ui/form/FormTextInput'
import FormTextarea from '@/shared/ui/form/FormTextarea'
import ItemViewModal from '@/shared/ui/ItemViewModal'
import ItemPickerModal from '@/features/character-editor/components/ItemPickerModal'
import { useEncounter } from '@/features/sessions/composables/useEncounter'

const props = defineProps({
  sessionUuid: { type: String, required: true },
  session: { type: Object, required: true },
  participants: { type: Array, default: () => [] },
  isDm: { type: Boolean, default: false },
})

const enc = reactive(useEncounter({
  sessionUuid: props.sessionUuid,
  participants: toRef(props, 'participants'),
  canEditPlayers: toRef(props, 'isDm'),
}))

provide('encounter', enc)

const combatItems = computed(() => enc.sortable.displayItems('combat'))
const npcItems = computed(() => enc.sortable.displayItems('reserve-npc'))
const playerItems = computed(() => enc.sortable.displayItems('reserve-player'))
const deadItems = computed(() => enc.sortable.displayItems('dead'))

const currentTurnUid = computed(() => enc.currentTurnUid)

const totalSelected = computed(() => enc.selectedUids?.size ?? 0)
const combatMoveCount = computed(() => enc.selectedToMoveTo('combat'))
const npcMoveCount = computed(() => enc.selectedToMoveTo('reserve-npc'))
const playerMoveCount = computed(() => enc.selectedToMoveTo('reserve-player'))
const deadMoveCount = computed(() => enc.selectedToMoveTo('dead'))
const allSelectedInCombat = computed(() =>
  combatItems.value.length > 0 && enc.selectedCountInGroup('combat') === combatItems.value.length
)
const allSelectedInNpcs = computed(() =>
  npcItems.value.length > 0 && enc.selectedCountInGroup('reserve-npc') === npcItems.value.length
)
const allSelectedInPlayers = computed(() =>
  playerItems.value.length > 0 && enc.selectedCountInGroup('reserve-player') === playerItems.value.length
)
const allSelectedInDead = computed(() =>
  deadItems.value.length > 0 && enc.selectedCountInGroup('dead') === deadItems.value.length
)

function onNpcGraveyard() {
  const c = enc.hpCalcNpc
  if (!c) return
  enc.sendToGraveyard(c)
  enc.closeHpCalc()
}

const simpleForm = reactive({ name: '', ac: 0, hp: 0, hpMax: 0, description: '' })

function onSimpleHp(val) {
  simpleForm.hp = val
  if (!simpleForm.hpMax || simpleForm.hpMax < val) simpleForm.hpMax = val
}

function submitSimple() {
  if (!simpleForm.name.trim()) return
  enc.addSimpleNpc({ ...simpleForm })
  enc.showSimpleForm = false
  simpleForm.name = ''
  simpleForm.ac = 0
  simpleForm.hp = 0
  simpleForm.hpMax = 0
  simpleForm.description = ''
}
</script>

<style scoped>
.enc-wrap {
  display: flex;
  flex-direction: column;
  gap: 0;
  padding: 0 0 24px;
  position: relative;
  /* This is the scroll container (NOT the rounded .tab-content tile — a rounded
     scroller would kill the toolbar's backdrop-filter blur). */
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}

/* ── Top toolbar — pinned frosted bar with a gradient-blur fade below ── */
.enc-toolbar {
  position: sticky;
  top: 0;
  z-index: 20;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  /* Lighter tint + a brightness/saturate lift so the frosted blur actually reads
     on the dark UI (dark-on-dark blur is otherwise invisible — just looks tinted). */
  background: color-mix(in srgb, var(--surface) 34%, transparent);
  backdrop-filter: blur(16px) saturate(1.6) brightness(1.4);
  -webkit-backdrop-filter: blur(16px) saturate(1.6) brightness(1.4);
  border-radius: var(--r-lg) var(--r-lg) 0 0;
  box-shadow: inset 0 -1px 0 color-mix(in srgb, var(--text-on-accent) 8%, transparent);
  margin: 0;
  flex-wrap: wrap;
}

/* Progressive blur + fade so content scrolling under the bar dissolves out. */
.enc-toolbar::after {
  content: "";
  position: absolute;
  left: 0;
  right: 0;
  top: 100%;
  height: 26px;
  pointer-events: none;
  background: linear-gradient(to bottom, color-mix(in srgb, var(--surface) 34%, transparent), transparent);
  backdrop-filter: blur(9px) brightness(1.3);
  -webkit-backdrop-filter: blur(9px) brightness(1.3);
  -webkit-mask-image: linear-gradient(to bottom, var(--bg), transparent);
  mask-image: linear-gradient(to bottom, var(--bg), transparent);
}

.enc-toolbar-left,
.enc-toolbar-right {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.enc-toolbar-right { margin-left: auto; }

.enc-tool-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  border: 1px solid color-mix(in srgb, var(--text-on-accent) 10%, transparent);
  background: color-mix(in srgb, var(--text-on-accent) 4%, transparent);
  color: var(--text-2);
  border-radius: 7px;
  padding: 7px 12px;
  font: inherit;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s, color 0.15s;
}
.enc-tool-btn:hover:not(:disabled) {
  background: color-mix(in srgb, var(--text-on-accent) 9%, transparent);
  border-color: color-mix(in srgb, var(--text-on-accent) 18%, transparent);
  color: var(--text-1);
}
.enc-tool-btn:disabled { opacity: 0.35; cursor: not-allowed; }

.enc-tool-btn--danger {
  background: color-mix(in srgb, var(--danger) 10%, transparent);
  border-color: color-mix(in srgb, var(--danger) 28%, transparent);
  color: var(--danger);
}
.enc-tool-btn--danger:hover:not(:disabled) {
  background: color-mix(in srgb, var(--danger) 22%, transparent);
  border-color: color-mix(in srgb, var(--danger) 50%, transparent);
  color: var(--danger);
}

.enc-tool-btn-count {
  font-weight: 700;
  opacity: 0.85;
}

.enc-status {
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.07em;
  border-radius: 5px;
  padding: 3px 8px;
  flex-shrink: 0;
}

.enc-status--live {
  color: var(--danger);
  background: color-mix(in srgb, var(--danger) 15%, transparent);
  border: 1px solid color-mix(in srgb, var(--danger) 30%, transparent);
}

.enc-status--idle {
  color: var(--text-2);
  background: color-mix(in srgb, var(--text-on-accent) 4%, transparent);
  border: 1px solid var(--border);
}

.enc-round-wrap {
  display: flex;
  align-items: baseline;
  gap: 5px;
  background: color-mix(in srgb, var(--text-on-accent) 5%, transparent);
  border: 1px solid color-mix(in srgb, var(--text-on-accent) 8%, transparent);
  border-radius: 7px;
  padding: 5px 11px;
}

.enc-round-label {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.06em;
  color: var(--text-2);
  text-transform: uppercase;
}

.enc-round-num {
  font-size: 15px;
  font-weight: 700;
  color: var(--text-1);
}

.enc-turn-btn {
  display: flex;
  align-items: center;
  gap: 5px;
  border: 1px solid color-mix(in srgb, var(--text-on-accent) 10%, transparent);
  background: color-mix(in srgb, var(--text-on-accent) 4%, transparent);
  color: var(--text-2);
  border-radius: 7px;
  padding: 6px 12px;
  font: inherit;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;
}

.enc-turn-btn:hover:not(:disabled) {
  background: color-mix(in srgb, var(--text-on-accent) 9%, transparent);
  border-color: color-mix(in srgb, var(--text-on-accent) 18%, transparent);
  color: var(--text-1);
}

.enc-turn-btn:disabled { opacity: 0.3; cursor: not-allowed; }

.enc-turn-btn--next {
  background: color-mix(in srgb, var(--accent) 12%, transparent);
  border-color: color-mix(in srgb, var(--accent) 25%, transparent);
  color: var(--accent);
}

.enc-turn-btn--next:hover:not(:disabled) {
  background: color-mix(in srgb, var(--accent) 24%, transparent);
  border-color: color-mix(in srgb, var(--accent) 40%, transparent);
  color: var(--accent);
}

.enc-combat-btn {
  border: none;
  border-radius: 7px;
  padding: 7px 14px;
  font: inherit;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s;
}

.enc-combat-btn--start { background: var(--accent); color: var(--text-on-accent); }
.enc-combat-btn--start:hover { background: var(--accent); }

.enc-combat-btn--end { background: color-mix(in srgb, var(--danger) 12%, transparent); color: var(--danger); }
.enc-combat-btn--end:hover { background: color-mix(in srgb, var(--danger) 24%, transparent); }

.enc-combat-btn:disabled { opacity: 0.45; cursor: not-allowed; }
.enc-combat-btn-count {
  margin-left: 6px;
  font-weight: 700;
  opacity: 0.85;
}

.enc-section-title-row {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 28px;
  padding: 0 14px;
}

.enc-section-title-row .enc-section-title {
  flex-shrink: 0;
}

.enc-section-title-row .enc-send-btn {
  margin-left: auto;
}

.enc-select-btn,
.enc-send-btn {
  background: color-mix(in srgb, var(--section-color) 12%, transparent);
  border: 1px solid color-mix(in srgb, var(--section-color) 45%, transparent);
  color: color-mix(in srgb, var(--section-color) 75%, var(--text-1));
  border-radius: 7px;
  padding: 6px 14px;
  font-family: inherit;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.05em;
  cursor: pointer;
  transition: background 0.12s, border-color 0.12s, color 0.12s, opacity 0.12s;
}
.enc-select-btn:hover:not(:disabled),
.enc-send-btn:hover:not(:disabled) {
  background: color-mix(in srgb, var(--section-color) 22%, transparent);
  border-color: color-mix(in srgb, var(--section-color) 70%, transparent);
  color: var(--text-1);
}
.enc-select-btn:disabled,
.enc-send-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.enc-send-btn {
  background: color-mix(in srgb, var(--section-color) 28%, transparent);
  border-color: color-mix(in srgb, var(--section-color) 60%, transparent);
  color: var(--text-1);
}
.enc-send-btn:hover:not(:disabled) {
  background: color-mix(in srgb, var(--section-color) 42%, transparent);
  border-color: var(--section-color);
}

.enc-section-title--dead {
  color: var(--text-1);
}

/* ── Combat list ── */
.enc-empty {
  font-size: 12px;
  color: var(--text-muted);
  padding: 8px 14px;
}

.enc-rows {
  display: flex;
  flex-direction: column;
  gap: 0;
}

/* ── Section blocks (title + card) ── */
.enc-block {
  --section-color: var(--text-muted);
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin: 16px 0 0;
}
.enc-block:first-child { margin-top: 6px; }

.enc-block--combat  { --section-color: var(--danger); }
.enc-block--npc     { --section-color: var(--accent-hover); }
.enc-block--players { --section-color: var(--info); }
.enc-block--dead    { --section-color: var(--danger); }

.enc-block--disabled { opacity: 0.45; }
.enc-block--disabled .enc-add-dashed,
.enc-block--disabled .enc-reserve-list { pointer-events: none; }

.enc-section {
  background: none;
  border: none;
  border-radius: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

/* Combatant rows are frameless and separated by thin dividers (no per-row card). */
.enc-rows :deep(.enc-row:not(:first-child)),
.enc-reserve-list :deep(.enc-row:not(:first-child)) {
  border-top: 1px solid var(--border);
}

.enc-section-title {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.09em;
  color: var(--text-1);
}

.enc-section-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--section-color);
  box-shadow: 0 0 8px color-mix(in srgb, var(--section-color) 60%, transparent);
  flex-shrink: 0;
}

.enc-section-disabled-hint {
  color: var(--text-muted);
  font-weight: 500;
  letter-spacing: 0;
}

.enc-reserve-empty {
  font-size: 12px;
  color: var(--text-muted);
  padding: 6px 14px;
}

.enc-reserve-list {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.enc-add-dashed {
  width: 100%;
  background: none;
  border: 1.5px dashed color-mix(in srgb, var(--section-color) 35%, transparent);
  border-radius: 12px;
  color: color-mix(in srgb, var(--section-color) 75%, var(--text-2));
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  padding: 10px 14px;
  min-height: 44px;
  cursor: pointer;
  text-align: center;
  transition: border-color 0.15s, color 0.15s, background 0.15s;
}
.enc-add-dashed:hover {
  border-color: var(--section-color);
  color: var(--text-1);
  background: color-mix(in srgb, var(--section-color) 8%, transparent);
}

.enc-add-row {
  display: flex;
  gap: 6px;
}
.enc-add-row .enc-add-dashed { flex: 1; }

.simple-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
}

.hp-edit-title {
  color: var(--text-1);
  font-size: 15px;
  font-weight: 700;
  padding-right: 24px;
  margin-bottom: 4px;
}
</style>
