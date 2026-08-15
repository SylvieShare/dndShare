<template>
  <EditorPanel :title="title">
    <!-- ── Значение характеристики ── -->
    <EditorSection title="Значение">
      <FormField label="Основное значение">
        <FormNumberInput :value="baseData.base" @change="setBase" />
      </FormField>
      <BonusList :bonuses="baseData.bonuses || []" @update:bonuses="setBaseBonuses" />
    </EditorSection>

    <!-- ── Спасбросок ── -->
    <EditorSection title="Спасбросок">
      <button class="se-prof-toggle" :class="{ 'se-prof-on': saveUp }" type="button" @click="$emit('toggle-save')">
        <span class="se-prof-dot" :class="{ 'se-prof-dot-on': saveUp }"></span>
        <span class="se-prof-label">Владение спасброском</span>
        <span class="se-prof-badge">{{ saveUp ? 'Есть' : 'Нет' }}</span>
      </button>
      <BonusList :bonuses="saveBonuses || []" @update:bonuses="$emit('update-save-bonuses', $event)" />
    </EditorSection>

    <!-- ── Навыки ── -->
    <EditorSection title="Навыки">
      <button
        v-for="skill in skills"
        :key="skill.id"
        class="se-skill-row"
        type="button"
        @click="$emit('open-skill', skill.id)"
      >
        <span class="se-skill-name">{{ skill.title }}</span>
        <span class="se-skill-prof" :class="`se-skill-prof--${skill.up}`">{{ profLabel(skill.up) }}</span>
        <span class="se-skill-chip">{{ signed(skill.bonus) }}</span>
        <span
          v-if="skill.custom"
          class="se-skill-del"
          role="button"
          title="Удалить навык"
          @click.stop="$emit('delete-skill', skill.id)"
        >×</span>
        <span class="se-skill-arrow">›</span>
      </button>

      <AddButton
        v-if="allowAddSkills && !adding"
        block
        @click="startAdding"
      >Добавить навык</AddButton>
      <form v-else-if="allowAddSkills" class="se-add-row" @submit.prevent="onAddSubmit">
        <input
          ref="addInputEl"
          v-model="newSkillName"
          class="se-add-input"
          type="text"
          placeholder="Название навыка"
          @keydown.esc.stop="cancelAdding"
          @blur="onAddBlur"
        />
        <button class="se-add-btn" type="submit" :disabled="!newSkillName.trim()">Добавить</button>
      </form>
    </EditorSection>
  </EditorPanel>
</template>

<script setup>
import { nextTick, ref } from 'vue'
import { signedOrZero as signed } from '@/shared/lib/dnd'
import AddButton from '@/shared/ui/AddButton'
import BonusList from '@/shared/ui/BonusList'
import EditorPanel from '@/features/character-editor/components/EditorPanel'
import EditorSection from '@/features/character-editor/components/EditorSection'
import { FormField } from '@sylvieshare/share-ui'
import { FormNumberInput } from '@sylvieshare/share-ui'

const props = defineProps({
  title: { type: String, default: '' },
  baseData: { type: Object, default: () => ({ base: 10, bonuses: [] }) },
  saveUp: { type: Boolean, default: false },
  saveBonuses: { type: Array, default: () => [] },
  skills: { type: Array, default: () => [] },
  allowAddSkills: { type: Boolean, default: false },
})
const emit = defineEmits(['update-base', 'toggle-save', 'update-save-bonuses', 'open-skill', 'delete-skill', 'add-skill'])

const newSkillName = ref('')
const adding = ref(false)
const addInputEl = ref(null)

function profLabel(up) { return up >= 2 ? 'Мастерство' : up === 1 ? 'Владение' : '—' }

function setBase(v) { emit('update-base', { ...props.baseData, base: v }) }
function setBaseBonuses(v) { emit('update-base', { ...props.baseData, bonuses: v }) }

function startAdding() { adding.value = true; nextTick(() => addInputEl.value?.focus()) }
function cancelAdding() { adding.value = false; newSkillName.value = '' }
function onAddBlur() { if (!newSkillName.value.trim()) cancelAdding() }
function onAddSubmit() {
  const name = newSkillName.value.trim()
  if (!name) return
  emit('add-skill', name)
  newSkillName.value = ''
  adding.value = false
}
</script>

<style scoped>
/* ── Save proficiency toggle ── */
.se-prof-toggle {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  background: var(--surface-raised);
  border: 1px solid var(--border);
  border-radius: 9px;
  padding: 8px 12px;
  cursor: pointer;
  font-family: inherit;
  transition: border-color 0.15s, background 0.15s;
  text-align: left;
}
.se-prof-toggle:hover { border-color: var(--border-strong); }
.se-prof-on { border-color: var(--accent); background: color-mix(in srgb, var(--accent) 8%, var(--surface-raised)); }

.se-prof-dot {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  border: 1.5px solid var(--border-strong);
  flex-shrink: 0;
  transition: background 0.15s, border-color 0.15s;
}
.se-prof-dot-on { background: var(--accent); border-color: var(--accent); }

.se-prof-label { flex: 1; color: var(--text-2); font-size: 13px; font-weight: 500; }
.se-prof-on .se-prof-label { color: var(--text-1); }
.se-prof-badge { font-size: 11px; font-weight: 700; color: var(--text-muted); letter-spacing: 0.04em; }
.se-prof-on .se-prof-badge { color: var(--accent); }

/* ── Skill rows ── */
.se-skill-row {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  background: var(--surface-raised);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 7px 10px;
  cursor: pointer;
  font-family: inherit;
  text-align: left;
  transition: border-color 0.12s, background 0.12s;
}
.se-skill-row:hover { border-color: var(--border-strong); background: var(--surface-active); }

.se-skill-name {
  flex: 1;
  color: var(--text-1);
  font-size: 13px;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.se-skill-prof {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.04em;
  color: var(--text-muted);
  flex-shrink: 0;
}
.se-skill-prof--1 { color: var(--text-2); }
.se-skill-prof--2 { color: var(--accent); }

.se-skill-chip {
  min-width: 34px;
  text-align: center;
  background: var(--surface-active);
  border-radius: 6px;
  padding: 2px 6px;
  color: var(--text-1);
  font-size: 12px;
  font-weight: 700;
  flex-shrink: 0;
}

.se-skill-del {
  width: 18px;
  text-align: center;
  color: var(--danger);
  font-size: 15px;
  line-height: 1;
  flex-shrink: 0;
  border-radius: 4px;
}
.se-skill-del:hover { color: var(--danger); }

.se-skill-arrow { color: var(--text-muted); font-size: 16px; flex-shrink: 0; }

.se-add-row { display: flex; gap: 8px; align-items: stretch; }

.se-add-input {
  flex: 1;
  min-width: 0;
  background: var(--surface-raised);
  border: 1px solid var(--border-strong);
  border-radius: 8px;
  color: var(--text-1);
  font-size: 13px;
  font-family: inherit;
  padding: 7px 10px;
  outline: none;
  transition: border-color 0.12s;
}
.se-add-input::placeholder { color: var(--text-muted); }
.se-add-input:focus { border-color: var(--accent); }

.se-add-btn {
  flex-shrink: 0;
  border: none;
  border-radius: 8px;
  background: var(--surface-active);
  color: var(--text-1);
  font-size: 13px;
  font-weight: 600;
  font-family: inherit;
  padding: 0 14px;
  cursor: pointer;
  transition: background 0.12s, opacity 0.12s;
}
.se-add-btn:hover { background: color-mix(in srgb, var(--accent) 30%, var(--surface-active)); }
.se-add-btn:disabled { opacity: 0.4; cursor: default; }
</style>
