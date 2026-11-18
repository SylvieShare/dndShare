<template>
  <div
    class="skill-rank-bar"
    :role="editable ? 'radiogroup' : 'meter'"
    :aria-label="label"
    :aria-valuemin="editable ? undefined : 0"
    :aria-valuemax="editable ? undefined : skillMax"
    :aria-valuenow="editable ? undefined : rank"
  >
    <input
      v-if="editable"
      class="rank-radio rank-zero"
      type="radio"
      :name="name"
      :checked="rank === 0"
      aria-label="Ранг 0"
      @change="emit('select', 0)"
    />
    <component
      :is="editable ? 'label' : 'span'"
      v-for="value in skillMax"
      :key="value"
      class="rank-segment"
      :class="{ 'rank-segment--filled': value <= rank, 'rank-segment--editable': editable }"
    >
      <input
        v-if="editable"
        class="rank-radio"
        type="radio"
        :name="name"
        :checked="rank === value"
        :aria-label="`Ранг ${value}`"
        @change="emit('select', value)"
      />
      <span aria-hidden="true" />
    </component>
  </div>
</template>

<script setup>
import { useId } from 'vue'
import { RED_CORE_PROFILE } from '../../../settings/cyberpunk-red/creation'

defineProps({ rank: Number, editable: Boolean, label: String })
const emit = defineEmits(['select'])
const { skillMax } = RED_CORE_PROFILE
const name = `red-skill-rank-${useId()}`
</script>

<style scoped>
.skill-rank-bar {
  position: relative;
  display: grid;
  grid-template-columns: repeat(v-bind(skillMax), minmax(0, 1fr));
  gap: var(--spacing-xs);
}
.rank-segment { position: relative; display: grid; align-items: center; min-height: 8px; }
.rank-segment--editable { cursor: pointer; min-height: 24px; }
.rank-segment span { height: 5px; border-radius: 999px; background: var(--border-strong); }
.rank-segment--filled span { background: var(--accent); }
.rank-segment--editable:hover span { background: var(--accent-soft); }
.rank-radio {
  position: absolute;
  inline-size: 1px;
  block-size: 1px;
  margin: 0;
  opacity: 0;
}
.rank-segment:has(:focus-visible), .skill-rank-bar:has(> .rank-zero:focus-visible) {
  outline: 2px solid var(--accent-soft);
  outline-offset: 2px;
  border-radius: var(--r-md);
}
</style>
