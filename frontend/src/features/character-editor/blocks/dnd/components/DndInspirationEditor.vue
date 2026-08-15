<template>
  <EditorPanel :title="embedded ? '' : 'Вдохновение'">
    <button
      class="die-toggle"
      :class="{ 'die-toggle--active': active }"
      type="button"
      :aria-pressed="active"
      @click="$emit('change', !active)"
    >
      <span class="die-mark" aria-hidden="true">✦</span>
      <span class="die-copy">
        <strong>{{ active ? 'Вдохновение есть' : 'Нет вдохновения' }}</strong>
        <span>{{ active ? 'Нажмите, чтобы потратить' : 'Нажмите, чтобы выдать' }}</span>
      </span>
    </button>
    <p class="die-note">Героическое вдохновение выдаёт мастер игры; его можно потратить, чтобы перебросить кубик.</p>
  </EditorPanel>
</template>

<script setup>
import { computed } from 'vue'
import { EditorPanel } from '@sylvieshare/share-ui'
import { isInspirationActive } from '@/features/character-editor/blocks/dnd/lib/mobileStatus'

const props = defineProps({
  value: { type: [Boolean, Number], default: false },
  embedded: { type: Boolean, default: false },
})

defineEmits(['change'])

const active = computed(() => isInspirationActive(props.value))
</script>

<style scoped>
.die-toggle {
  display: flex;
  align-items: center;
  gap: 14px;
  width: 100%;
  min-height: 76px;
  padding: 14px 15px;
  border: 1px solid var(--border-strong);
  border-radius: var(--r-md);
  background: color-mix(in srgb, var(--text-on-accent) 3%, transparent);
  color: var(--text-muted);
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s, color 0.15s;
}

.die-toggle--active {
  border-color: color-mix(in srgb, var(--accent) 72%, var(--border-strong));
  background: color-mix(in srgb, var(--accent) 13%, transparent);
  color: var(--accent-soft);
}

.die-mark { flex: 0 0 auto; font-size: 30px; line-height: 1; }
.die-copy { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.die-copy strong { color: var(--text-1); font-size: 14px; }
.die-copy span { font-size: 12px; }
.die-note { margin: 0; color: var(--text-muted); font-size: 12px; line-height: 1.5; }
</style>
