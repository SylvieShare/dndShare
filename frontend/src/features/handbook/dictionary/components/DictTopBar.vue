<template>
  <div class="dict-top-bar">
    <div class="dict-top-bar-inner">
      <router-link to="/handbook" class="bar-back">
        <svg viewBox="0 0 16 16" fill="none" width="14" height="14">
          <path d="M10 13L5 8L10 3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        К коллекциям
      </router-link>

      <span v-if="typeName" class="bar-type-name">{{ typeName }}</span>

      <button v-if="canAdd && typeName" class="bar-add-btn" @click="$emit('add')">+ Добавить</button>
    </div>
  </div>
</template>

<script setup>
defineProps({
  typeName: { type: String, default: '' },
  canAdd: { type: Boolean, default: false },
})

defineEmits(['add'])
</script>

<style scoped>
.dict-top-bar {
  flex-shrink: 0;
  background: var(--bg-header);
  border-bottom: 1px solid var(--border);
}

.dict-top-bar-inner {
  display: flex;
  align-items: center;
  gap: 16px;
  max-width: 1400px;
  margin: 0 auto;
  padding: 10px 24px;
}

.bar-back {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-2);
  text-decoration: none;
  flex-shrink: 0;
  transition: color 0.12s;
}
.bar-back:hover { color: var(--text-1); }

.bar-type-name {
  font-family: var(--font-display);
  font-size: 22px;
  font-weight: 600;
  color: var(--text-1);
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.bar-add-btn {
  flex-shrink: 0;
  background: none;
  border: 1px dashed var(--border);
  color: var(--text-2);
  border-radius: 7px;
  padding: 5px 14px;
  font: inherit;
  font-size: 12px;
  cursor: pointer;
  transition: color 0.15s, border-color 0.15s, background 0.15s;
}
.bar-add-btn:hover { color: var(--text-1); border-color: var(--accent); background: rgba(106,100,216,0.08); }

@media (max-width: 520px) {
  .dict-top-bar-inner { padding: 8px 10px; gap: 10px; }
  .bar-type-name { font-size: 18px; }
}
</style>
