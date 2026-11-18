<template>
  <ItemPickerModal
    v-if="enc.showNpcPicker&&!enc.isRed"
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
        <FormField :label="enc.isRed?'SP тела':'Класс брони'" vertical>
          <FormNumberInput :value="simpleForm.ac" :min="0" :max="99" @change="simpleForm.ac = $event" />
        </FormField>
        <FormField label="Текущие HP" vertical>
          <FormNumberInput :value="simpleForm.hp" :min="0" :max="9999" @change="onSimpleHp" />
        </FormField>
        <FormField label="Максимум HP" vertical>
          <FormNumberInput :value="simpleForm.hpMax" :min="0" :max="9999" @change="simpleForm.hpMax = $event" />
        </FormField>
      </div>
      <template v-if="enc.isRed"><FormField label="SP головы" vertical><FormNumberInput :value="simpleForm.headSP" :min="0" :max="30" @change="simpleForm.headSP=$event"/></FormField><FormField v-for="stat in redStats" :key="stat" :label="stat" vertical><FormNumberInput :value="simpleForm.redStats[stat]" :min="0" :max="20" @change="simpleForm.redStats[stat]=$event"/></FormField></template><FormField label="Описание" vertical>
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
      v-if="enc.hpCalcNpc&&!enc.isRed"
      :hp="enc.npcHpObj(enc.hpCalcNpc)"
      :damage-pending="enc.impactBusy"
      :damage-handler="amount => enc.applyDamageToCombatant(enc.hpCalcNpc, amount)"
      is-npc
      @close="enc.closeHpCalc"
      @change="enc.onNpcHpChange"
      @defeat="onNpcDefeat"
    />
    <AppModalFrame v-if="enc.hpCalcNpc&&enc.isRed" title="Здоровье NPC · RED" @close="enc.closeHpCalc"><p>HP {{enc.npcHpObj(enc.hpCalcNpc).current}} / {{enc.npcHpMax(enc.hpCalcNpc)}}</p><p>SP тела {{enc.hpCalcNpc.override?.redArmor?.body||0}} · головы {{enc.hpCalcNpc.override?.redArmor?.head||0}}</p><FormField label="Входящий урон в тело, до SP" vertical><FormNumberInput :value="redNpcDamage" :min="0" :max="999" @change="redNpcDamage=$event"/></FormField><ActionButton :disabled="enc.impactBusy" @click="applyRedNpcDamage">Применить урон</ActionButton><ActionButton @click="enc.openNpcHpEdit(enc.hpCalcNpc);enc.closeHpCalc()">Изменить HP</ActionButton></AppModalFrame>
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
        <FormNumberInput :disabled="enc.impactBusy" live :value="enc.hpEditNpc.hpCurrent ?? 0" :min="0" :max="999" @change="enc.setNpcHpField('current', $event)" />
      </FormField>
      <FormField label="Максимум HP">
        <FormNumberInput :disabled="enc.impactBusy" live :value="enc.npcHpMax(enc.hpEditNpc)" :min="0" :max="999" @change="enc.setNpcHpField('max', $event)" />
      </FormField>
      <FormField v-if="!enc.isRed" label="Временные HP">
        <FormNumberInput :disabled="enc.impactBusy" live :value="enc.hpEditNpc.hpTemp ?? 0" :min="0" :max="999" @change="enc.setNpcHpField('temp', $event)" />
      </FormField>
    </AppModalFrame>

</template>
<script setup>
import { provide, reactive,ref } from 'vue'
import { AppModalFrame,ActionButton } from '@sylvieshare/share-ui'
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

function onNpcDefeat() {
  const c = enc.hpCalcNpc
  if (!c) return
  enc.markDefeated(c)
  enc.closeHpCalc()
}

const redStats=['INT','REF','DEX','TECH','COOL','WILL','LUCK','MOVE','BODY','EMP'],redNpcDamage=ref(0)
const simpleForm = reactive({ name: '', ac: 0, hp: 0, hpMax: 0, description: '',headSP:0,redStats:Object.fromEntries(redStats.map(k=>[k,6])) })

async function applyRedNpcDamage() {
  try {
    await enc.applyDamageToCombatant(enc.hpCalcNpc, redNpcDamage.value)
  } catch {
    // The encounter shows the synchronization error and retry action.
  }
}

function onSimpleHp(val) {
  simpleForm.hp = val
  if (!simpleForm.hpMax || simpleForm.hpMax < val) simpleForm.hpMax = val
}

function submitSimple() {
  if (!simpleForm.name.trim()) return
  enc.addSimpleNpc({ ...simpleForm,redStats:enc.isRed?simpleForm.redStats:undefined })
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
