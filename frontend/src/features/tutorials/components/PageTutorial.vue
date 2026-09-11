<template>
  <GuidedTour :tour="tutorial.tour" :mobile="mobile" :labels="labels" />
  <AppModalFrame v-if="tutorial.loadError.value" title="Обучение" @close="tutorial.loadError.value = ''">
    <p role="alert">{{ tutorial.loadError.value }}</p>
    <ActionButton @click="tutorial.restart">Повторить</ActionButton>
  </AppModalFrame>
</template>
<script setup>
import { ActionButton, AppModalFrame, GuidedTour } from '@sylvieshare/share-ui'
defineProps({ tutorial: { type: Object, required: true }, mobile: Boolean })
const labels = {
  progress: (current, total) => `Шаг ${current} из ${total}`, next: 'Далее', previous: 'Назад',
  finish: 'Завершить', dismiss: 'Пропустить', close: 'Закрыть', retry: 'Повторить', loading: 'Подождите…',
  error: 'Не удалось показать шаг или сохранить результат. Повторите попытку. Обучение можно запустить снова из настроек.',
}
</script>
