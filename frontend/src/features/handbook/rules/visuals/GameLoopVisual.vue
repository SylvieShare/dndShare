<template>
  <ol class="game-loop" aria-label="Пример игрового цикла за столом">
    <li v-for="(step, index) in steps" :key="step.title" class="game-loop-item">
      <BaseTile class="game-loop-step" :color="step.color" tint>
        <img class="game-loop-scene" :src="step.image" :alt="step.imageAlt">
        <span class="game-loop-copy">
          <span class="game-loop-meta">
            <span class="game-loop-icon"><component :is="step.icon" aria-hidden="true" /></span>
            <span class="game-loop-order">0{{ index + 1 }}</span>
          </span>
          <strong>{{ step.title }}</strong>
          <span class="game-loop-dialogue">
            <span v-for="line in step.dialogue" :key="`${line.role}-${line.text}`" class="game-loop-line">
              <span class="game-loop-role">{{ line.role }}</span>
              <span>«{{ line.text }}»</span>
            </span>
          </span>
        </span>
      </BaseTile>
      <ArrowRight v-if="index < steps.length - 1" class="game-loop-arrow" aria-hidden="true" />
    </li>
  </ol>
</template>

<script setup>
import { ArrowRight, Dices, MessageSquareText, Sparkles, Target } from '@lucide/vue'
import { BaseTile } from '@sylvieshare/share-ui'
import actionImage from '@/features/handbook/rules/assets/game-loop-2-action.jpg'
import consequencesImage from '@/features/handbook/rules/assets/game-loop-4-consequences.jpg'
import resolutionImage from '@/features/handbook/rules/assets/game-loop-3-resolution.jpg'
import situationImage from '@/features/handbook/rules/assets/game-loop-1-situation.jpg'

const steps = [
  {
    title: 'Ситуация',
    icon: MessageSquareText,
    color: 'var(--info)',
    image: situationImage,
    imageAlt: 'Лиссара оценивает разрушенный мост над подземной рекой',
    dialogue: [{ role: 'Мастер', text: 'Мост разрушен, внизу река. Позади слышны шаги патруля.' }],
  },
  {
    title: 'Действие',
    icon: Target,
    color: 'var(--accent)',
    image: actionImage,
    imageAlt: 'Лиссара закрепляет кошку и проверяет верёвку',
    dialogue: [{ role: 'Игрок', text: 'Я цепляю кошку за арку, проверяю верёвку и пытаюсь перелететь на другую сторону.' }],
  },
  {
    title: 'Разрешение',
    icon: Dices,
    color: 'var(--warning)',
    image: resolutionImage,
    imageAlt: 'Лиссара перелетает пропасть на натянутой верёвке',
    dialogue: [
      { role: 'Мастер', text: 'Ты спешишь, а камни скользкие. Сделай проверку Ловкости (Акробатика).' },
      { role: 'Игрок', text: 'С модификатором — 17.' },
    ],
  },
  {
    title: 'Последствия',
    icon: Sparkles,
    color: 'var(--success)',
    image: consequencesImage,
    imageAlt: 'Лиссара приземляется, пока камни срываются в пропасть и патруль замечает шум',
    dialogue: [{ role: 'Мастер', text: 'Ты приземляешься, но камни срываются вниз. Патруль услышал шум. Что ты делаешь?' }],
  },
]
</script>

<style scoped>
.game-loop {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  align-items: stretch;
  gap: 34px;
  margin: 24px 0 26px;
  padding: 0;
  list-style: none;
}
.game-loop-item { position: relative; min-width: 0; }
.game-loop-step { min-height: 0; height: 100%; padding: 0; overflow: hidden; box-sizing: border-box; }
.game-loop-scene {
  display: block;
  width: 100%;
  aspect-ratio: 16 / 9;
  border-bottom: 1px solid var(--border);
  object-fit: cover;
}
.game-loop-copy { display: flex; flex-direction: column; padding: 13px 14px 15px; }
.game-loop-meta { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
.game-loop-icon { width: 34px; height: 34px; display: grid; place-items: center; border-radius: 9px; color: var(--tile-color); background: color-mix(in srgb, var(--tile-color) 13%, transparent); }
.game-loop-icon :deep(svg) { width: 18px; height: 18px; }
.game-loop-order { color: var(--text-muted); font-size: 9px; letter-spacing: .08em; }
.game-loop-step strong { color: var(--text-1); font-family: var(--font-display); font-size: 19px; }
.game-loop-dialogue { display: grid; gap: 8px; margin-top: 9px; }
.game-loop-line { display: grid; gap: 4px; color: var(--text-2); font-family: var(--font-prose); font-size: 11px; line-height: 1.45; }
.game-loop-role { width: fit-content; color: var(--tile-color); font-family: var(--font-ui); font-size: 9px; font-weight: 800; letter-spacing: .06em; text-transform: uppercase; }
.game-loop-arrow { position: absolute; top: 50%; right: -26px; width: 18px; color: var(--text-muted); transform: translateY(-50%); }
@media (max-width: 780px) {
  .game-loop {
    grid-template-columns: repeat(4, minmax(260px, 78vw));
    padding-bottom: 10px;
    overflow-x: auto;
    overscroll-behavior-inline: contain;
    scroll-snap-type: inline mandatory;
  }
  .game-loop-item { scroll-snap-align: start; }
}

@media (max-width: 420px) {
  .game-loop-copy { padding: 11px 12px 12px; }
  .game-loop-meta { margin-bottom: 8px; }
  .game-loop-icon { width: 30px; height: 30px; }
  .game-loop-icon :deep(svg) { width: 16px; height: 16px; }
  .game-loop-step strong { font-size: 17px; }
  .game-loop-line { font-size: 11px; }
}
</style>
