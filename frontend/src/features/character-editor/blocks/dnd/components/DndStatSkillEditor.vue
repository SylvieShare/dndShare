<template>
  <EditorPanel>
    <button class="sk-back" type="button" @click="$emit('back')">
      <span class="sk-back-arrow">‹</span>
      <span class="sk-back-label">Навыки</span>
    </button>

    <div class="sk-title-row">
      <input
        v-if="renaming"
        ref="renameInput"
        class="sk-rename"
        :value="local.override_title"
        :placeholder="skill.title"
        @input="update('override_title', $event.target.value)"
        @keydown.enter.prevent="blurRename"
        @blur="onRenameBlur"
      />
      <template v-else>
        <div class="sk-title">{{ skill.title }}</div>
        <button class="sk-rename-btn" type="button" title="Переименовать" @click="startRename">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
          </svg>
        </button>
      </template>
    </div>

    <EditorSection title="Степень умения">
      <div class="sk-prof-row">
        <button
          v-for="opt in profOptions"
          :key="opt.value"
          class="sk-prof-btn"
          :class="{ 'sk-prof-active': local.up === opt.value }"
          type="button"
          @click="update('up', opt.value)"
        >{{ opt.label }}</button>
      </div>
    </EditorSection>

    <EditorSection title="Бонусы">
      <BonusList :bonuses="local.bonuses" @update:bonuses="update('bonuses', $event)" />
    </EditorSection>

    <EditorTotal>Итого: <strong>{{ signed(total) }}</strong></EditorTotal>
  </EditorPanel>
</template>

<script setup>
import { computed, nextTick, reactive, ref } from 'vue'
import { signedOrZero as signed, sumBonuses } from '@/shared/lib/dnd'
import BonusList from '@/shared/ui/BonusList'
import EditorPanel from '@/features/character-editor/components/EditorPanel'
import EditorSection from '@/features/character-editor/components/EditorSection'
import EditorTotal from '@/features/character-editor/components/EditorTotal'

const props = defineProps({
  skill: { type: Object, required: true },
  mod: { type: Number, default: 0 },
  profBonus: { type: Number, default: 2 },
})
const emit = defineEmits(['change', 'back'])

const local = reactive({
  up: props.skill.up || 0,
  override_title: props.skill.override_title || '',
  bonuses: [...(props.skill.bonuses || [])],
})

// rename: pencil → input; Enter blurs; empty + blur removes the override
const renaming = ref(false)
const renameInput = ref(null)
function startRename() { renaming.value = true; nextTick(() => renameInput.value?.focus()) }
function blurRename() { renameInput.value?.blur() }
function onRenameBlur() {
  if (!local.override_title.trim()) update('override_title', '')
  renaming.value = false
}

const profOptions = [
  { value: 0, label: '—' },
  { value: 1, label: 'Владение' },
  { value: 2, label: 'Мастерство' },
]

const total = computed(() => {
  const extra = sumBonuses(local.bonuses)
  return props.mod + (local.up || 0) * props.profBonus + extra
})

function update(field, value) {
  local[field] = value
  emit('change', { up: local.up, override_title: local.override_title, bonuses: local.bonuses })
}
</script>

<style scoped>
.sk-back {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  align-self: flex-start;
  background: none;
  border: none;
  color: var(--text-2);
  font-family: inherit;
  font-size: 13px;
  cursor: pointer;
  padding: 2px 6px 2px 0;
  border-radius: 6px;
  transition: color 0.12s;
}
.sk-back:hover { color: var(--text-1); }
.sk-back-arrow { font-size: 20px; line-height: 1; }

.sk-title-row { display: flex; align-items: center; gap: 6px; min-height: 30px; }
.sk-title {
  color: var(--text-1);
  font-size: 16px;
  font-weight: 700;
}
.sk-rename-btn {
  display: grid;
  place-items: center;
  width: 24px;
  height: 24px;
  flex-shrink: 0;
  border: none;
  border-radius: 6px;
  background: none;
  color: var(--text-muted);
  cursor: pointer;
  opacity: 0.35;
  transition: color 0.15s, opacity 0.15s;
}
@media (hover: hover) { .sk-rename-btn:hover { color: var(--accent); opacity: 1; } }
.sk-rename-btn:focus-visible { color: var(--accent); opacity: 1; }
.sk-rename {
  flex: 1;
  min-width: 0;
  background: var(--surface-raised);
  border: 1px solid var(--accent);
  border-radius: 8px;
  color: var(--text-1);
  font: inherit;
  font-size: 15px;
  font-weight: 600;
  padding: 5px 10px;
  outline: none;
}
.sk-rename::placeholder { color: var(--text-muted); font-weight: 400; }

.sk-prof-row { display: flex; gap: 6px; }

.sk-prof-btn {
  flex: 1;
  height: 32px;
  border-radius: 7px;
  border: 1px solid var(--border-strong);
  background: transparent;
  color: var(--text-muted);
  font: inherit;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: border-color 0.12s, color 0.12s, background 0.12s;
}
.sk-prof-btn:hover { border-color: var(--text-muted); color: var(--text-2); }
.sk-prof-active {
  border-color: var(--accent);
  background: color-mix(in srgb, var(--accent) 12%, transparent);
  color: var(--accent-soft);
}
</style>
