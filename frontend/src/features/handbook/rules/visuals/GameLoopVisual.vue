<template>
  <div class="game-loop" role="img" aria-label="Игровой цикл: мастер описывает ситуацию, игрок выбирает цель и способ, при необходимости происходит бросок, затем мир отвечает последствиями">
    <template v-for="(step, index) in steps" :key="step.title">
      <BaseTile class="game-loop-step" :color="step.color" tint>
        <span
          class="game-loop-scene"
          :class="`game-loop-scene--${index + 1}`"
          :style="{ backgroundImage: `url(${storyboardUrl})` }"
          aria-hidden="true"
        />
        <span class="game-loop-copy">
          <span class="game-loop-meta">
            <span class="game-loop-icon"><component :is="step.icon" aria-hidden="true" /></span>
            <span class="game-loop-order">0{{ index + 1 }}</span>
          </span>
          <strong>{{ step.title }}</strong>
          <span>{{ step.text }}</span>
        </span>
      </BaseTile>
      <ArrowRight v-if="index < steps.length - 1" class="game-loop-arrow" aria-hidden="true" />
    </template>
  </div>
</template>

<script setup>
import { ArrowRight, Dices, MessageSquareText, Sparkles, Target } from '@lucide/vue'
import { BaseTile } from '@sylvieshare/share-ui'
import storyboardUrl from '@/features/handbook/rules/assets/game-loop-lissara-storyboard.jpg'

const steps = [
  { title: 'Ситуация', text: 'Мастер описывает мир и опасность.', icon: MessageSquareText, color: 'var(--info)' },
  { title: 'Намерение', text: 'Ты называешь цель и способ.', icon: Target, color: 'var(--accent)' },
  { title: 'Решение', text: 'Иногда достаточно плана, иногда нужен d20.', icon: Dices, color: 'var(--warning)' },
  { title: 'Последствия', text: 'История меняется, начинается новый выбор.', icon: Sparkles, color: 'var(--success)' },
]
</script>

<style scoped>
.game-loop {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 18px minmax(0, 1fr) 18px minmax(0, 1fr) 18px minmax(0, 1fr);
  align-items: center;
  gap: 8px;
  margin: 24px 0 26px;
}
.game-loop-step { min-height: 0; padding: 0; overflow: hidden; }
.game-loop-scene {
  display: block;
  width: 100%;
  aspect-ratio: 4 / 3;
  border-bottom: 1px solid var(--border);
  background-size: 200% 200%;
  background-repeat: no-repeat;
}
.game-loop-scene--1 { background-position: left top; }
.game-loop-scene--2 { background-position: right top; }
.game-loop-scene--3 { background-position: left bottom; }
.game-loop-scene--4 { background-position: right bottom; }
.game-loop-copy { display: flex; flex-direction: column; padding: 13px 14px 15px; }
.game-loop-meta { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
.game-loop-icon { width: 34px; height: 34px; display: grid; place-items: center; border-radius: 9px; color: var(--tile-color); background: color-mix(in srgb, var(--tile-color) 13%, transparent); }
.game-loop-icon :deep(svg) { width: 18px; height: 18px; }
.game-loop-order { color: var(--text-muted); font-size: 9px; letter-spacing: .08em; }
.game-loop-step strong { color: var(--text-1); font-family: var(--font-display); font-size: 19px; }
.game-loop-copy > span:last-child { margin-top: 5px; color: var(--text-2); font-size: 11px; line-height: 1.45; }
.game-loop-arrow { width: 18px; color: var(--text-muted); }
@media (max-width: 780px) {
  .game-loop { grid-template-columns: 1fr; }
  .game-loop-step { display: grid; grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr); }
  .game-loop-scene { border-right: 1px solid var(--border); border-bottom: 0; }
  .game-loop-arrow { transform: rotate(90deg); justify-self: center; }
}

@media (max-width: 420px) {
  .game-loop-copy { padding: 11px 12px 12px; }
  .game-loop-meta { margin-bottom: 8px; }
  .game-loop-icon { width: 30px; height: 30px; }
  .game-loop-icon :deep(svg) { width: 16px; height: 16px; }
  .game-loop-step strong { font-size: 17px; }
  .game-loop-copy > span:last-child { font-size: 10px; }
}
</style>
