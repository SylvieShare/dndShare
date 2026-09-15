<template>
  <div class="tools-columns">
    <BaseTile class="tools-settings">
      <h2>Состав находки</h2>
      <p class="tools-muted">Предметы выбираются из справочников по отметке участия, уровню и весу выпадения.</p>
      <div class="tools-fields">
        <FormField label="Уровень группы" vertical title="Фильтрует авторский диапазон уровней у предмета."><FormTextInput v-model:value="options.level" type="number" min="1" max="20" /></FormField>
        <FormField label="Предметов" vertical title="До 20 разных записей. Если подходящих меньше, генератор покажет доступные."><FormTextInput v-model:value="options.count" type="number" min="0" max="20" /></FormField>
        <FormField label="Состав" vertical><FormSelect v-model:value="options.pool" @update:value="options.typeId = ''"><option value="magic">Магические предметы и зелья</option><option value="mundane">Обычное снаряжение</option><option value="all">Все предметы</option></FormSelect></FormField>
        <FormField label="Максимальная редкость" vertical><FormSelect v-model:value="options.maxRarity"><option v-for="(name, i) in RARITIES" :key="i" :value="i">{{ name }}</option></FormSelect></FormField>
        <FormField label="Справочник" vertical><FormSelect v-model:value="options.typeId"><option value="">Все подходящие</option><option v-for="type in visibleTypes" :key="type.id" :value="type.id">{{ type.name }}</option></FormSelect></FormField>
        <FormField label="Только общие предметы" title="Выключите, чтобы включить ваши личные записи с отметкой участия."><ToggleSwitch v-model="options.publicOnly" aria-label="Только общие предметы" /></FormField>
        <FormField label="Монеты от, зм" vertical><FormTextInput v-model:value="options.goldMin" type="number" min="0" max="1000000" /></FormField>
        <FormField label="Монеты до, зм" vertical><FormTextInput v-model:value="options.goldMax" type="number" min="0" max="1000000" /></FormField>
      </div>
      <p class="tools-muted">Монеты бросаются отдельно от предметов. Это настраиваемый подбор, не таблицы сокровищ из книги мастера.</p>
      <p v-if="error" role="alert">{{ error }} <ActionButton variant="secondary" @click="load">Повторить загрузку</ActionButton></p>
      <p v-else-if="validation" role="alert">{{ validation }}</p>
      <p v-else class="tools-muted">{{ candidates.length }} подходящих предметов</p>
      <ActionButton :disabled="loading || !!error || !!validation || (!candidates.length && Number(options.count) > 0)" @click="generate"><template #icon><Dices :size="18" /></template> {{ result ? 'Сгенерировать ещё' : 'Сгенерировать сокровища' }}</ActionButton>
    </BaseTile>
    <div class="tools-result" aria-live="polite">
      <LoadingState v-if="loading" label="Собираем предметы…" />
      <BaseTile v-else-if="!result" class="tools-empty"><Gem :size="40" /><h2>Здесь появятся сокровища</h2><p>{{ candidates.length ? 'Выберите состав находки и бросьте кости.' : 'Нет подходящих предметов. Измените фильтры или включите участие в редакторе предмета.' }}</p></BaseTile>
      <template v-else>
        <div class="tools-result-heading"><div><span class="tools-eyebrow">Находка</span><h2>{{ result.gold.toLocaleString('ru') }} золотых</h2></div><ActionButton variant="secondary" @click="copy"><template #icon><Copy :size="16" /></template> {{ copyLabel }}</ActionButton></div>
        <p v-if="result.missing" class="tools-muted">Не хватило {{ result.missing }} разных предметов. Показаны все доступные по этим условиям.</p>
        <SectionList v-if="result.items.length" title="Предметы">
          <div v-for="item in result.items" :key="item.id" class="treasure-row">
            <button class="treasure-item" :aria-label="`Открыть ${item.name}`" @click="selected = item"><HandbookListItem :item="item" /></button>
            <span v-if="item.data?.weapon && !item.data.weapon.base_item_id" class="tools-muted treasure-note">Оружейную основу можно выбрать в свойствах экземпляра на листе.</span>
          </div>
        </SectionList>
        <p v-else class="tools-muted">В этой находке только монеты.</p>
      </template>
    </div>
  </div>
</template>
<script setup>
import { toRefs } from 'vue'
import { ActionButton, BaseTile, FormField, FormSelect, FormTextInput, LoadingState, SectionList, ToggleSwitch } from '@sylvieshare/share-ui'
import { Copy, Dices, Gem } from '@lucide/vue'
import HandbookListItem from '@/features/items/list-components/HandbookListItem.vue'
import { RARITIES } from '../lib/treasureGenerator'
const props = defineProps({ controller: { type: Object, required: true } })
const { options, loading, error, result, selected, copyLabel, visibleTypes, validation, candidates } = toRefs(props.controller)
const { load, generate, copy } = props.controller
</script>

<style scoped src="../styles/masterTools.css"></style>
