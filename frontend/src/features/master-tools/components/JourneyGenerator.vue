<template>
  <div class="tools-columns">
    <BaseTile class="tools-settings">
      <h2>{{ mode === 'camp' ? 'Где проходит ночлег' : 'Что ждёт в пути' }}</h2>
      <FormField label="Место" vertical><FormSelect v-model:value="place"><option v-for="p in places" :key="p.value" :value="p.value">{{ p.label }}</option></FormSelect></FormField>
      <FormField label="Настроение сцены" vertical><FormSelect v-model:value="mood"><option value="any">Любое</option><option value="calm">Спокойная встреча</option><option value="mystery">Тайна</option><option value="danger">Осложнение</option></FormSelect></FormField>
      <p class="tools-muted">{{ candidates.length }} сцен подходят. Это заготовки для импровизации: сложность проверок и последствия определяет мастер.</p>
      <ActionButton :disabled="!candidates.length" @click="generate"><template #icon><Dices :size="18" /></template> {{ result ? 'Другое событие' : 'Придумать событие' }}</ActionButton>
    </BaseTile>
    <BaseTile class="tools-result tools-scene" aria-live="polite">
      <template v-if="result">
        <div class="tools-result-heading"><span class="tools-eyebrow">{{ moodLabels[result.mood] }}</span><ActionButton variant="secondary" @click="copy"><template #icon><Copy :size="16" /></template> {{ copyLabel }}</ActionButton></div>
        <h2>{{ result.title }}</h2>
        <p class="tools-scene-lead">{{ result.scene }}</p>
        <section><h3>Перед каким выбором окажутся герои</h3><p>{{ result.choice }}</p></section>
        <section><h3>Возможное развитие</h3><p>{{ result.outcome }}</p></section>
      </template>
      <div v-else class="tools-empty"><component :is="mode === 'camp' ? Tent : Signpost" :size="40" /><h2>Повод для следующей сцены</h2><p>Выберите место и настроение. Событие появится после броска.</p></div>
    </BaseTile>
  </div>
</template>
<script setup>
import { computed, ref } from 'vue'
import { ActionButton, BaseTile, FormField, FormSelect } from '@sylvieshare/share-ui'
import { Copy, Dices, Signpost, Tent } from '@lucide/vue'
import { eventCandidates, eventText, generateEvent } from '../lib/journeyEvents'
const props = defineProps({ mode: String })
const place = ref(props.mode === 'camp' ? 'wild' : 'road'), mood = ref('any'), result = ref(null), copyLabel = ref('Скопировать')
const places = computed(() => props.mode === 'camp' ? [{ value: 'wild', label: 'Лагерь на природе' }, { value: 'inn', label: 'Трактир или постоялый двор' }] : [{ value: 'road', label: 'Дорога' }, { value: 'wild', label: 'Дикая местность' }, { value: 'ruins', label: 'Руины' }])
const moodLabels = { calm: 'Спокойная встреча', mystery: 'Тайна', danger: 'Осложнение' }
const options = computed(() => ({ mode: props.mode, place: place.value, mood: mood.value }))
const candidates = computed(() => eventCandidates(options.value))
function generate() { result.value = generateEvent(options.value, result.value?.id); copyLabel.value = 'Скопировать' }
async function copy() { try { await navigator.clipboard.writeText(eventText(result.value)); copyLabel.value = 'Скопировано' } catch { copyLabel.value = 'Не удалось скопировать' } }
</script>
