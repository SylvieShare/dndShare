<template>
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
      :damage-handler="amount => enc.applyDamageToCombatant(enc.hpCalcNpc, amount)"
      is-npc
      @close="enc.closeHpCalc"
      @change="enc.onNpcHpChange"
      @graveyard="onNpcGraveyard"
    />
    <ItemViewModal
      v-if="enc.detailNpc && enc.detailNpc.itemId != null"
      :item-type-id="6"
      :item-id="enc.detailNpc.itemId"
      :item="enc.npcItem(enc.detailNpc) ?? null"
      :actor-name="enc.npcName(enc.detailNpc)"
          :npc-actor="enc.npcActor(enc.detailNpc)"
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
</template>
<script setup>
import { provide, reactive } from 'vue'
import { AppModalFrame } from '@sylvieshare/share-ui'
import DndHpCalcModal from '@/features/character-editor/blocks/dnd/DndHpCalcModal'
import { FormActionButtons } from '@sylvieshare/share-ui'
import { FormField } from '@sylvieshare/share-ui'
import { FormNumberInput } from '@sylvieshare/share-ui'
import { FormTextInput } from '@sylvieshare/share-ui'
import { FormTextarea } from '@sylvieshare/share-ui'
import ItemViewModal from '@/features/handbook/components/ItemViewModal.vue'
import ItemPickerModal from '@/features/handbook/components/ItemPickerModal.vue'
const props = defineProps({ encounter: { type: Object, required: true } })
const enc = props.encounter
provide('encounter', enc)

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
.simple-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
}
</style>
