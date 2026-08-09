<template>
  <section v-if="profile" class="equipment">
    <div class="sheet-section-title">Стартовое снаряжение</div>
    <p class="hint">Выберите варианты из «Книги игрока». Предметы автоматически попадут в инвентарь.</p>

    <div v-for="(group, groupIndex) in profile.groups" :key="group.id" class="choice-group">
      <div class="choice-title">{{ group.label || `Выбор ${groupIndex + 1}` }}</div>

      <label
        v-for="entry in group.options"
        :key="entry.id"
        class="choice-option"
        :class="{ selected: optionSelected(group, entry) }"
      >
        <input
          v-if="group.options.length > 1"
          type="radio"
          :name="`class-equipment-${profile.key}-${group.id}`"
          :checked="optionSelected(group, entry)"
          @change="selectEquipmentOption(group.id, entry.id)"
        />
        <span v-else class="single-mark" aria-hidden="true">•</span>
        <span>{{ entry.label }}</span>
      </label>

      <template v-for="entry in group.options" :key="`${entry.id}-picks`">
        <div v-if="optionSelected(group, entry) && entry.picks?.length" class="concrete-picks">
          <template v-for="pick in entry.picks" :key="pick.id">
            <label v-for="index in pick.count" :key="`${pick.id}-${index}`" class="concrete-pick">
              <span>{{ pick.label }}<template v-if="pick.count > 1"> {{ index }}</template></span>
              <select
                class="pick-select"
                :value="pickValue(group.id, pick.id, index - 1)"
                @change="setEquipmentPick(group.id, entry.id, pick.id, index - 1, $event.target.value)"
              >
                <option value="">Выберите…</option>
                <option v-for="name in pick.options" :key="name" :value="name">{{ name }}</option>
              </select>
            </label>
          </template>
        </div>
      </template>
    </div>

    <div v-if="profile.fixed.length" class="fixed">
      <span class="fixed-title">Также получите</span>
      <span class="fixed-list">{{ fixedLabel }}</span>
    </div>
  </section>
</template>

<script setup>
import { computed, inject } from 'vue'

const {
  state, classEquipmentProfile: profile,
  selectEquipmentOption, setEquipmentPick,
} = inject('createWizard')

function optionSelected(group, entry) {
  const selected = state.classEquipmentChoices?.[group.id]?.optionId
  return selected === entry.id || (selected == null && group.options.length === 1)
}

function pickValue(groupId, pickId, index) {
  return state.classEquipmentChoices?.[groupId]?.picks?.[pickId]?.[index] || ''
}

const fixedLabel = computed(() => profile.value.fixed
  .map((entry) => entry.count > 1 ? `${entry.name} ×${entry.count}` : entry.name)
  .join(', '))
</script>

<style scoped>
.equipment { display: flex; flex-direction: column; gap: 10px; }
.hint { font-size: 12px; color: var(--text-muted); margin: -3px 0 0; line-height: 1.4; }
.choice-group {
  display: flex; flex-direction: column; gap: 5px;
  padding: 10px 12px; border: 1px solid var(--border); border-radius: var(--r-md);
  background: color-mix(in srgb, var(--surface) 80%, transparent);
}
.choice-title { font-size: 10px; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; color: var(--text-muted); margin-bottom: 2px; }
.choice-option {
  display: flex; align-items: flex-start; gap: 8px; padding: 5px 7px;
  border-radius: var(--r-sm); color: var(--text-2); font-size: 13px; line-height: 1.35; cursor: pointer;
}
.choice-option:hover, .choice-option.selected { color: var(--text-1); background: color-mix(in srgb, var(--accent) 9%, transparent); }
.choice-option input { margin: 2px 0 0; accent-color: var(--accent); }
.single-mark { color: var(--accent); font-size: 18px; line-height: 12px; }
.concrete-picks { display: grid; gap: 8px; padding: 5px 7px 3px 27px; }
.concrete-pick { display: grid; grid-template-columns: minmax(120px, 0.7fr) minmax(180px, 1.3fr); align-items: center; gap: 10px; font-size: 12px; color: var(--text-muted); }
.pick-select {
  width: 100%; box-sizing: border-box; background: var(--surface-raised); border: 1px solid var(--border-strong);
  border-radius: 7px; color: var(--text-1); font: inherit; font-size: 12px; padding: 7px 9px; outline: none;
}
.pick-select:focus { border-color: var(--accent); }
.fixed { display: flex; flex-direction: column; gap: 3px; padding: 10px 13px; background: var(--surface); border-radius: var(--r-md); }
.fixed-title { font-size: 10px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; color: var(--accent); }
.fixed-list { font-size: 12px; color: var(--text-2); line-height: 1.45; }

@media (max-width: 640px) {
  .concrete-pick { grid-template-columns: 1fr; gap: 4px; }
}
</style>
