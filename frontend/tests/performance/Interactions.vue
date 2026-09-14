<template>
  <main>
    <section style="width:320px" data-testid="search">
      <SearchMultiSelect v-model="selected" :options="options" label="Навыки" :limit="2" allow-create @create="create" />
      <output>{{ selected.join(',') }}</output>
      <SuggestPicker v-model="suggestion" :items="suggestions" placeholder="Вариант" />
      <output data-testid="suggestion">{{ suggestion }}</output>
    </section>
    <button ref="anchor" style="position:fixed;right:5px;bottom:5px" @click="tooltip = !tooltip">Подсказка</button>
    <FloatingTooltip v-if="tooltip" :anchor="anchor" :width="300">Длинная подсказка, которая остаётся внутри окна браузера.</FloatingTooltip>
    <button @click="count = 10">Десять</button>
    <button @click="groupBy = groupBy ? null : 'category'">Группы</button>
    <div style="height:400px;display:flex;width:600px;max-width:100vw">
      <HandbookItemList style="flex:1;min-height:0" :type="type" :items="items" :group-by="groupBy" @select="activated = $event.id" />
    </div>
    <output data-testid="activated">{{ activated }}</output>
  </main>
</template>
<script setup>
import { computed, ref } from 'vue'
import { SearchMultiSelect, FloatingTooltip } from '@sylvieshare/share-ui'
import SuggestPicker from '../../src/shared/ui/SuggestPicker.vue'
import HandbookItemList from '../../src/features/handbook/components/HandbookItemList.vue'
const selected = ref([]), options = ref([{value: 1, label: 'Акробатика'}, {value: 2, label: 'Атлетика'}, {value: 3, label: 'Магия'}])
const suggestions = [{id: 1, value: 'Первый'}, {id: 2, value: 'Второй'}], suggestion = ref('')
function create(label) { const value = options.value.length + 1; options.value.push({value, label}); selected.value = [...selected.value, value] }
const anchor = ref(null), tooltip = ref(false), count = ref(2000), groupBy = ref(null), activated = ref(null)
const type = { id: 2, name: 'Предметы', fields: [{ key: 'category', name: 'Категория', type: 'string', group: true }] }
const items = computed(() => Array.from({ length: count.value }, (_, i) => ({id: i + 1, typeId: 2, name: `Предмет ${i + 1}${i % 7 === 0 ? ' с очень длинным многострочным названием'.repeat(5) : ''}`, data: { category: i < 1000 ? 'А' : 'Б' } })))
</script>
