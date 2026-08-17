<template>
  <div class="game-loop" role="img" aria-label="Игровой цикл: мастер описывает ситуацию, игрок выбирает цель и способ, при необходимости происходит бросок, затем мир отвечает последствиями">
    <template v-for="(step, index) in steps" :key="step.title">
      <BaseTile class="game-loop-step" :color="step.color" tint>
        <span class="game-loop-icon"><component :is="step.icon" aria-hidden="true" /></span>
        <span class="game-loop-order">0{{ index + 1 }}</span>
        <strong>{{ step.title }}</strong>
        <span>{{ step.text }}</span>
      </BaseTile>
      <ArrowRight v-if="index < steps.length - 1" class="game-loop-arrow" aria-hidden="true" />
    </template>
  </div>
</template>

<script setup>
import { ArrowRight, Dices, MessageSquareText, Sparkles, Target } from '@lucide/vue'
import { BaseTile } from '@sylvieshare/share-ui'

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
.game-loop-step { min-height: 178px; display: flex; flex-direction: column; padding: 16px; }
.game-loop-icon { width: 34px; height: 34px; display: grid; place-items: center; border-radius: 9px; color: var(--tile-color); background: color-mix(in srgb, var(--tile-color) 13%, transparent); }
.game-loop-icon :deep(svg) { width: 18px; height: 18px; }
.game-loop-order { margin: 20px 0 5px; color: var(--text-muted); font-size: 9px; letter-spacing: .08em; }
.game-loop-step strong { color: var(--text-1); font-family: var(--font-display); font-size: 19px; }
.game-loop-step > span:last-child { margin-top: 5px; color: var(--text-2); font-size: 11px; line-height: 1.45; }
.game-loop-arrow { width: 18px; color: var(--text-muted); }
@media (max-width: 780px) {
  .game-loop { grid-template-columns: 1fr; }
  .game-loop-step { min-height: 0; }
  .game-loop-arrow { transform: rotate(90deg); justify-self: center; }
}
</style>
