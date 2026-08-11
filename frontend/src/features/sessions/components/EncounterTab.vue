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

    <AppModalFrame v-if="enc.showSimpleForm" title="Своё существо" @close="enc.showSimpleForm = false">
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
      <template #footer>
        <FormActionButtons
          submit-text="Добавить"
          :can-submit="!!simpleForm.name.trim()"
          @cancel="enc.showSimpleForm = false"
          @submit="submitSimple"
        />
      </template>
    </AppModalFrame>
    <DndHpCalcModal
      v-if="enc.hpCalcNpc"
      :hp="enc.npcHpObj(enc.hpCalcNpc)"
      is-npc
      @close="enc.closeHpCalc"
      @change="enc.onNpcHpChange"
      @graveyard="onNpcGraveyard"
    />
    <DndHpCalcModal
      v-if="enc.hpCalcPlayer"
      :hp="enc.playerHpObj(enc.hpCalcPlayer)"
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

    <AppModalFrame v-if="enc.hpEditNpc" :title="`${enc.npcName(enc.hpEditNpc)} · хиты`" @close="enc.closeNpcHpEdit">
      <FormField label="Текущие HP">
        <FormNumberInput :value="enc.hpEditNpc.hpCurrent ?? 0" :min="0" :max="999" @change="enc.setNpcHpField('current', $event)" />
      </FormField>
      <FormField label="Максимум HP">
        <FormNumberInput :value="enc.npcHpMax(enc.hpEditNpc)" :min="0" :max="999" @change="enc.setNpcHpField('max', $event)" />
      </FormField>
      <FormField label="Временные HP">
        <FormNumberInput :value="enc.hpEditNpc.hpTemp ?? 0" :min="0" :max="999" @change="enc.setNpcHpField('temp', $event)" />
      </FormField>
    </AppModalFrame>
  </div>
</template>

<script setup>
import { computed, provide, reactive, toRef } from 'vue'
import AppModalFrame from '@/shared/ui/AppModalFrame.vue'
import DndHpCalcModal from '@/features/character-editor/blocks/dnd/DndHpCalcModal'
import EncounterRow from '@/features/sessions/components/EncounterRow'
import FormActionButtons from '@/shared/ui/form/FormActionButtons'
import FormField from '@/shared/ui/form/FormField'
import FormNumberInput from '@/shared/ui/form/FormNumberInput'
import FormTextInput from '@/shared/ui/form/FormTextInput'
import FormTextarea from '@/shared/ui/form/FormTextarea'
import ItemViewModal from '@/features/handbook/components/ItemViewModal.vue'
import ItemPickerModal from '@/features/handbook/components/ItemPickerModal.vue'
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

<style scoped src="./styles/EncounterTab.css"></style>
