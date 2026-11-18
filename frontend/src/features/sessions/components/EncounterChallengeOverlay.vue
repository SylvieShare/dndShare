<template>
  <Transition name="enc-row-roll" appear>
    <div
      v-if="result && !hidden"
      class="enc-row-roll-overlay"
      :class="{ 'enc-row-roll--placeholder': placeholder }"
      data-challenge-result
      @pointerdown.stop @click.stop @contextmenu.stop @keydown.esc.stop.prevent="hideResult"
    >
      <EncounterChallengeResult
        class="enc-row-result" :challenge="encounter.challenge" :busy="encounter.challengeBusy"
        :ability="ability" :result="result" @reroll="encounter.rerollChallenge(combatant, $event)"
      />
    </div>
  </Transition>
  <button
    v-if="result" ref="toggle" class="enc-row-roll-toggle" :class="{ 'enc-row-roll--placeholder': placeholder }" type="button"
    data-challenge-result :title="toggleLabel" :aria-label="toggleLabel" :aria-expanded="!hidden"
    @pointerdown.stop @click.stop="hidden = !hidden"
  >
    <Dices v-if="hidden" :size="14" /><ChevronRight v-else :size="14" />
  </button>
</template>

<script setup>
import { ChevronRight, Dices } from '@lucide/vue'
import { computed, nextTick, ref, watch } from 'vue'
import EncounterChallengeResult from './EncounterChallengeResult.vue'

const props = defineProps({
  combatant: { type: Object, required: true },
  encounter: { type: Object, required: true },
  placeholder: Boolean,
})
const result = computed(() => props.combatant.position === 'dead' ? null : props.encounter.challengeResult?.(props.combatant))
const ability = computed(() => props.encounter.challengeAbilityMeta(props.encounter.challenge?.ability))
const hidden = ref(false)
const toggle = ref(null)
const toggleLabel = computed(() => hidden.value ? 'Показать результат броска' : 'Скрыть результат броска')

watch(result, () => { hidden.value = false })

function hideResult() {
  hidden.value = true
  nextTick(() => toggle.value?.focus())
}
</script>

<style scoped>
.enc-row-roll-overlay {
  position: absolute;
  z-index: 2;
  inset: 2px 2px 2px auto;
  width: min(248px, max(0px, calc(100% - var(--layout-touch-min))));
  display: flex;
  align-items: center;
  overflow: hidden;
  border-radius: 0 calc(var(--r-lg) - 2px) calc(var(--r-lg) - 2px) 0;
  background: var(--surface);
  box-shadow: -8px 0 16px color-mix(in srgb, var(--scrim) 20%, transparent);
}
.enc-row-result { width: 100%; }
.enc-row-roll-toggle {
  position: absolute;
  right: 4px;
  bottom: 3px;
  z-index: 3;
  display: grid;
  place-items: center;
  width: 22px;
  height: 18px;
  padding: 0;
  border: 0;
  border-radius: var(--r-sm);
  background: var(--surface-raised);
  color: var(--text-muted);
  cursor: pointer;
  transition: color .16s, background .16s;
}
.enc-row-roll-toggle:hover { color: var(--accent); background: var(--surface-active); }
.enc-row-roll--placeholder { visibility: hidden; }
.enc-row-roll-enter-active, .enc-row-roll-leave-active { transition: transform .26s cubic-bezier(.22, 1, .36, 1), opacity .18s; }
.enc-row-roll-enter-from, .enc-row-roll-leave-to { transform: translateX(105%); opacity: 0; }
.enc-row-roll-leave-active { pointer-events: none; }
@media (prefers-reduced-motion: reduce) {
  .enc-row-roll-enter-active, .enc-row-roll-leave-active, .enc-row-roll-toggle { transition: none; }
  .enc-row-roll-enter-from, .enc-row-roll-leave-to { transform: none; opacity: 1; }
}
</style>
