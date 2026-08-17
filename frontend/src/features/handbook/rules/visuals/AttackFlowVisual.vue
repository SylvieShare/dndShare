<template>
  <BaseTile class="attack-visual" color="var(--danger)" framed>
    <header class="attack-head">
      <span><Crosshair aria-hidden="true" /> Короткий лук Лиры</span>
      <span>цель: КД {{ targetAc }}</span>
    </header>

    <div class="attack-flow" aria-live="polite">
      <div class="attack-step" :class="{ active: true }">
        <span class="attack-step-number">1</span>
        <SystemDie :sides="20" :value="attackNatural" :size="54" :animated="false" />
        <span><strong>d20 {{ formatSigned(attackBonus) }}</strong><small>бросок атаки</small></span>
      </div>
      <ArrowRight aria-hidden="true" />
      <div class="attack-step attack-compare" :class="hit ? 'attack-hit' : 'attack-miss'">
        <span class="attack-step-number">2</span>
        <strong>{{ attackTotal }} {{ hit ? '≥' : '<' }} {{ targetAc }}</strong>
        <span>{{ critical ? 'Критическое попадание' : hit ? 'Попадание' : 'Промах' }}</span>
      </div>
      <ArrowRight aria-hidden="true" />
      <div class="attack-step" :class="{ active: hit, disabled: !hit }">
        <span class="attack-step-number">3</span>
        <SystemDie :sides="6" :value="damageDie || 6" :size="54" :animated="false" />
        <span><strong>{{ critical ? '2d6' : '1d6' }} + 3{{ damageTotal != null ? ` = ${damageTotal}` : '' }}</strong><small>{{ hit ? 'урон' : 'урона нет' }}</small></span>
      </div>
    </div>

    <div class="attack-actions">
      <span>{{ resultHint }}</span>
      <div>
        <button type="button" @click="rollAttack"><Crosshair aria-hidden="true" /> Бросить атаку</button>
        <button type="button" :disabled="!hit" @click="rollDamage"><Dices aria-hidden="true" /> Бросить урон</button>
      </div>
    </div>
  </BaseTile>
</template>

<script setup>
import { computed, ref } from 'vue'
import { ArrowRight, Crosshair, Dices } from '@lucide/vue'
import { BaseTile } from '@sylvieshare/share-ui'
import SystemDie from '@/shared/ui/SystemDie'
import { formatBonus } from '@/shared/lib/dnd'
import { useDiceStore } from '@/stores/dice'

const targetAc = 14
const attackBonus = 5
const attackNatural = ref(10)
const attackTotal = computed(() => attackNatural.value + attackBonus)
const critical = computed(() => attackNatural.value === 20)
const hit = computed(() => attackNatural.value !== 1 && (critical.value || attackTotal.value >= targetAc))
const damageDie = ref(null)
const damageTotal = ref(null)
const diceStore = useDiceStore()
const resultHint = computed(() => critical.value
  ? 'Натуральная 20: бросаются дополнительные кости урона.'
  : hit.value ? 'Итог достиг КД цели — теперь можно бросить урон.' : 'Итог ниже КД цели — урон не бросается.')

function formatSigned(value) { return formatBonus(value) }

function rollAttack() {
  const result = diceStore.roll('Учебная атака коротким луком', 'd20+5', { crit_mode: true, log: false })
  attackNatural.value = result.parts.find(part => part.kind === 'dice')?.rolls?.[0] || 1
  damageDie.value = null
  damageTotal.value = null
}

function rollDamage() {
  if (!hit.value) return
  const expression = critical.value ? '2d6+3' : 'd6+3'
  const result = diceStore.roll('Учебный урон короткого лука', expression, { log: false })
  const dicePart = result.parts.find(part => part.kind === 'dice')
  damageDie.value = dicePart?.rolls?.[0] || 1
  damageTotal.value = result.total
}
</script>

<style scoped>
.attack-visual { margin: 24px 0 28px; padding: 18px; }
.attack-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; color: var(--text-muted); font-size: 9px; letter-spacing: .07em; text-transform: uppercase; }
.attack-head span { display: flex; align-items: center; gap: 6px; }
.attack-head span:first-child { color: var(--danger); font-weight: 800; }
.attack-head svg { width: 15px; height: 15px; }
.attack-flow { display: grid; grid-template-columns: 1fr auto 1fr auto 1fr; align-items: center; gap: 10px; margin-top: 20px; }
.attack-flow > svg { width: 18px; color: var(--text-muted); }
.attack-step { position: relative; min-height: 104px; display: flex; align-items: center; justify-content: center; gap: 9px; padding: 12px; border-radius: 10px; background: var(--surface); box-shadow: inset 0 0 0 1px var(--border); opacity: .55; }
.attack-step.active,
.attack-compare { opacity: 1; }
.attack-step-number { position: absolute; top: 7px; left: 8px; color: var(--text-muted); font-size: 8px; }
.attack-step strong,
.attack-step small { display: block; }
.attack-step strong { color: var(--text-1); font-size: 14px; }
.attack-step small { margin-top: 2px; color: var(--text-muted); font-size: 8px; text-transform: uppercase; }
.attack-compare { flex-direction: column; gap: 5px; text-align: center; }
.attack-compare > strong { font-size: 25px; }
.attack-compare > span:last-child { font-size: 10px; font-weight: 800; text-transform: uppercase; }
.attack-hit { color: var(--success); background: color-mix(in srgb, var(--success) 8%, var(--surface)); }
.attack-miss { color: var(--danger); background: color-mix(in srgb, var(--danger) 8%, var(--surface)); }
.attack-actions { display: flex; align-items: center; justify-content: space-between; gap: 14px; margin-top: 16px; padding-top: 14px; border-top: 1px solid var(--border); }
.attack-actions > span { max-width: 430px; color: var(--text-muted); font-size: 10px; line-height: 1.4; }
.attack-actions > div { display: flex; gap: 7px; }
.attack-actions button { display: inline-flex; align-items: center; gap: 6px; padding: 8px 10px; border: 1px solid var(--border-strong); border-radius: 8px; color: var(--text-1); background: var(--surface-raised); font: inherit; font-size: 10px; font-weight: 700; cursor: pointer; }
.attack-actions button:first-child { border-color: color-mix(in srgb, var(--danger) 48%, var(--border)); }
.attack-actions button:hover:not(:disabled) { background: var(--surface-active); }
.attack-actions button:disabled { opacity: .35; cursor: not-allowed; }
.attack-actions button svg { width: 14px; height: 14px; color: var(--danger); }
@media (max-width: 720px) {
  .attack-flow { grid-template-columns: 1fr; }
  .attack-flow > svg { justify-self: center; transform: rotate(90deg); }
  .attack-actions { align-items: stretch; flex-direction: column; }
  .attack-actions > div { display: grid; grid-template-columns: 1fr 1fr; }
  .attack-actions button { justify-content: center; }
}
@media (max-width: 440px) {
  .attack-head { align-items: flex-start; flex-direction: column; }
  .attack-actions > div { grid-template-columns: 1fr; }
}
</style>
