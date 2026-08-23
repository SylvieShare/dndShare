<template>
  <div>
    <ol class="game-loop-schema" aria-label="Схема игрового цикла">
      <li v-for="(step, index) in steps" :key="step.title" class="game-loop-schema-item">
        <BaseTile class="game-loop-schema-step" :color="step.color" tint>
          <span class="game-loop-icon"><component :is="step.icon" aria-hidden="true" /></span>
          <span class="game-loop-order">0{{ index + 1 }}</span>
          <strong>{{ step.title }}</strong>
          <span>{{ step.summary }}</span>
        </BaseTile>
        <ArrowRight v-if="index < steps.length - 1" class="game-loop-schema-arrow" aria-hidden="true" />
      </li>
    </ol>

    <section class="game-loop-example" aria-labelledby="game-loop-example-title">
      <header class="game-loop-example-header">
        <span>
          <small>Пример за столом</small>
          <strong id="game-loop-example-title">Лиссара у разрушенного моста</strong>
        </span>
        <span class="game-loop-example-count">{{ activeIndex + 1 }} / {{ steps.length }}</span>
      </header>

      <BaseTile class="game-loop-slide" :color="activeStep.color" tint aria-live="polite">
        <img class="game-loop-scene" :src="activeStep.image" :alt="activeStep.imageAlt">
        <span class="game-loop-slide-copy">
          <span class="game-loop-slide-meta">
            <span class="game-loop-icon"><component :is="activeStep.icon" aria-hidden="true" /></span>
            <span class="game-loop-order">0{{ activeIndex + 1 }}</span>
          </span>
          <strong>{{ activeStep.title }}</strong>
          <span class="game-loop-dialogue">
            <span v-for="line in activeStep.dialogue" :key="`${line.role}-${line.text}`" class="game-loop-line">
              <span class="game-loop-role">{{ line.role }}</span>
              <span>«{{ line.text }}»</span>
            </span>
          </span>
        </span>
      </BaseTile>

      <nav class="game-loop-controls" aria-label="Переключение шагов примера">
        <button class="game-loop-control game-loop-control--arrow" type="button" :disabled="activeIndex === 0" aria-label="Предыдущий шаг" @click="selectPrevious">
          <ChevronLeft aria-hidden="true" />
        </button>
        <span class="game-loop-step-buttons">
          <button
            v-for="(step, index) in steps"
            :key="step.title"
            class="game-loop-control game-loop-control--step"
            :class="{ 'is-active': activeIndex === index }"
            :style="{ '--step-color': step.color }"
            type="button"
            :aria-current="activeIndex === index ? 'step' : undefined"
            :aria-label="`Шаг ${index + 1}: ${step.title}`"
            @click="activeIndex = index"
          >
            <span>0{{ index + 1 }}</span>
            {{ step.title }}
          </button>
        </span>
        <button class="game-loop-control game-loop-control--arrow" type="button" :disabled="activeIndex === steps.length - 1" aria-label="Следующий шаг" @click="selectNext">
          <ChevronRight aria-hidden="true" />
        </button>
      </nav>
    </section>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { ArrowRight, ChevronLeft, ChevronRight, Dices, MessageSquareText, Sparkles, Target } from '@lucide/vue'
import { BaseTile } from '@sylvieshare/share-ui'
import actionImage from '@/features/handbook/rules/assets/game-loop-2-action.jpg'
import consequencesImage from '@/features/handbook/rules/assets/game-loop-4-consequences.jpg'
import resolutionImage from '@/features/handbook/rules/assets/game-loop-3-resolution.jpg'
import situationImage from '@/features/handbook/rules/assets/game-loop-1-situation.jpg'

const steps = [
  {
    title: 'Ситуация', summary: 'Мастер описывает мир и опасность.', icon: MessageSquareText, color: 'var(--info)', image: situationImage,
    imageAlt: 'Лиссара оценивает разрушенный мост над подземной рекой',
    dialogue: [{ role: 'Мастер', text: 'Мост разрушен, внизу река. Позади слышны шаги патруля.' }],
  },
  {
    title: 'Действие', summary: 'Ты описываешь действие и цель.', icon: Target, color: 'var(--accent)', image: actionImage,
    imageAlt: 'Лиссара закрепляет кошку и проверяет верёвку',
    dialogue: [{ role: 'Игрок', text: 'Я цепляю кошку за арку, проверяю верёвку и пытаюсь перелететь на другую сторону.' }],
  },
  {
    title: 'Разрешение', summary: 'Мастер решает, нужен ли бросок.', icon: Dices, color: 'var(--warning)', image: resolutionImage,
    imageAlt: 'Лиссара перелетает пропасть на натянутой верёвке',
    dialogue: [
      { role: 'Мастер', text: 'Ты спешишь, а камни скользкие. Сделай проверку Ловкости (Акробатика).' },
      { role: 'Игрок', text: 'С модификатором — 17.' },
    ],
  },
  {
    title: 'Последствия', summary: 'Мир меняется, возникает новый выбор.', icon: Sparkles, color: 'var(--success)', image: consequencesImage,
    imageAlt: 'Лиссара приземляется, пока камни срываются в пропасть и патруль замечает шум',
    dialogue: [{ role: 'Мастер', text: 'Ты приземляешься, но камни срываются вниз. Патруль услышал шум. Что ты делаешь?' }],
  },
]

const activeIndex = ref(0)
const activeStep = computed(() => steps[activeIndex.value])
const selectPrevious = () => { activeIndex.value = Math.max(0, activeIndex.value - 1) }
const selectNext = () => { activeIndex.value = Math.min(steps.length - 1, activeIndex.value + 1) }
</script>

<style scoped>
.game-loop-schema { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); align-items: stretch; gap: 34px; margin: 24px 0 30px; padding: 0; list-style: none; }
.game-loop-schema-item { position: relative; min-width: 0; }
.game-loop-schema-step { min-height: 168px; display: flex; flex-direction: column; padding: 16px; }
.game-loop-icon { width: 34px; height: 34px; display: grid; place-items: center; border-radius: 9px; color: var(--tile-color); background: color-mix(in srgb, var(--tile-color) 13%, transparent); }
.game-loop-icon :deep(svg) { width: 18px; height: 18px; }
.game-loop-order { margin: 18px 0 5px; color: var(--text-muted); font-size: 9px; letter-spacing: .08em; }
.game-loop-schema-step strong,
.game-loop-slide-copy > strong { color: var(--text-1); font-family: var(--font-display); font-size: 19px; }
.game-loop-schema-step > span:last-child { margin-top: 5px; color: var(--text-2); font-size: 11px; line-height: 1.45; }
.game-loop-schema-arrow { position: absolute; top: 50%; right: -26px; width: 18px; color: var(--text-muted); transform: translateY(-50%); }
.game-loop-example { margin-top: 34px; }
.game-loop-example-header { display: flex; align-items: end; justify-content: space-between; gap: 20px; margin-bottom: 12px; }
.game-loop-example-header small,
.game-loop-example-header strong { display: block; }
.game-loop-example-header small { margin-bottom: 4px; color: var(--text-muted); font-size: 9px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; }
.game-loop-example-header strong { color: var(--text-1); font-family: var(--font-display); font-size: 22px; }
.game-loop-example-count { color: var(--text-muted); font-size: 10px; font-variant-numeric: tabular-nums; }
.game-loop-slide { display: grid; grid-template-columns: minmax(0, 1.45fr) minmax(220px, 1fr); padding: 0; overflow: hidden; }
.game-loop-scene { display: block; width: 100%; height: auto; aspect-ratio: 2 / 1; border-right: 1px solid var(--border); object-fit: cover; }
.game-loop-slide-copy { display: flex; flex-direction: column; justify-content: center; padding: 22px 24px; }
.game-loop-slide-meta { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
.game-loop-slide-meta .game-loop-order { margin: 0; }
.game-loop-dialogue { display: grid; gap: 9px; margin-top: 10px; }
.game-loop-line { display: grid; gap: 4px; color: var(--text-2); font-family: var(--font-prose); font-size: 12px; line-height: 1.5; }
.game-loop-role { width: fit-content; color: var(--tile-color); font-family: var(--font-ui); font-size: 9px; font-weight: 800; letter-spacing: .06em; text-transform: uppercase; }
.game-loop-controls { display: grid; grid-template-columns: 36px minmax(0, 1fr) 36px; align-items: center; gap: 8px; margin-top: 12px; }
.game-loop-step-buttons { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 6px; }
.game-loop-control { min-width: 0; height: 36px; border: 1px solid var(--border); border-radius: 8px; color: var(--text-muted); background: var(--surface); font: inherit; cursor: pointer; transition: color .15s, border-color .15s, background .15s; }
.game-loop-control:hover:not(:disabled) { color: var(--text-1); border-color: var(--border-strong); background: var(--surface-raised); }
.game-loop-control:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.game-loop-control:disabled { cursor: default; opacity: .35; }
.game-loop-control--arrow { display: grid; place-items: center; padding: 0; }
.game-loop-control--arrow svg { width: 17px; height: 17px; }
.game-loop-control--step { padding: 0 9px; overflow: hidden; font-size: 10px; text-overflow: ellipsis; white-space: nowrap; }
.game-loop-control--step span { margin-right: 5px; color: var(--text-muted); font-size: 8px; }
.game-loop-control--step.is-active { color: var(--text-1); border-color: color-mix(in srgb, var(--step-color) 60%, var(--border)); background: color-mix(in srgb, var(--step-color) 13%, var(--surface)); }
.game-loop-control--step.is-active span { color: var(--step-color); }
@media (max-width: 780px) {
  .game-loop-schema { grid-template-columns: 1fr; }
  .game-loop-schema-step { min-height: 0; }
  .game-loop-schema-arrow { top: auto; right: auto; bottom: -26px; left: 50%; transform: translateX(-50%) rotate(90deg); }
  .game-loop-slide { grid-template-columns: minmax(0, 1fr); }
  .game-loop-scene { border-right: 0; border-bottom: 1px solid var(--border); }
  .game-loop-step-buttons { grid-template-columns: repeat(4, 38px); justify-content: center; }
  .game-loop-control--step { padding: 0; font-size: 0; }
  .game-loop-control--step span { margin: 0; font-size: 9px; }
}
@media (max-width: 420px) {
  .game-loop-slide-copy { padding: 15px 16px 17px; }
  .game-loop-example-header strong { font-size: 19px; }
  .game-loop-controls { grid-template-columns: 34px minmax(0, 1fr) 34px; }
  .game-loop-step-buttons { grid-template-columns: repeat(4, 34px); }
}
</style>
