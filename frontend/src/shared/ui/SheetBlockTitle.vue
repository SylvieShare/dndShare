<template>
  <div class="sbt" :class="{ 'sbt--fade': editFade }">
    <div
      class="sbt-main"
      :class="{ 'sbt-main--clickable': clickableTitle && showEdit }"
      @click="clickableTitle && showEdit && $emit('edit')"
    >
      <span class="sbt-title">{{ upper ? title.toUpperCase() : title }}</span>
      <button
        v-if="showEdit"
        class="sbt-edit"
        type="button"
        title="Редактировать"
        @click.stop="$emit('edit')"
      >
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
        </svg>
      </button>
    </div>
    <div v-if="$slots.aside" class="sbt-aside"><slot name="aside" /></div>
  </div>
</template>

<script setup>
// Unified "view block" header: a title + an edit pencil that triggers the morph editor. Used by
// every morph-editable block's view (stat / exhaustion / statuses / proficiencies / abilities) so
// the header geometry and pencil behaviour are identical everywhere. Both the pencil and the title
// text open the editor (emit `edit`) whenever an edit affordance is shown — pass `:clickable-title="false"`
// to opt a block out. `edit-fade` fades the pencil out as the morph window opens (driven by the
// shell's `revealed` slot prop). `#aside` slot holds a right-aligned extra (e.g. the stat save-chip).
defineProps({
  title: { type: String, default: '' },
  showEdit: { type: Boolean, default: true },
  editFade: { type: Boolean, default: false },
  clickableTitle: { type: Boolean, default: true },
  upper: { type: Boolean, default: false },
})
defineEmits(['edit'])
</script>

<style scoped>
.sbt {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-width: 0;
}

.sbt-main {
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
}
.sbt-main--clickable { cursor: pointer; }

.sbt-title {
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
@media (hover: hover) {
  .sbt-main--clickable:hover .sbt-title { color: var(--text-2); }
  .sbt-main--clickable:hover .sbt-edit { color: var(--accent); opacity: 1; }
}

.sbt-edit {
  display: grid;
  place-items: center;
  width: 22px;
  height: 22px;
  flex-shrink: 0;
  border: none;
  border-radius: 6px;
  background: none;
  color: var(--text-muted);
  cursor: pointer;
  opacity: 0.35;
  transition: color 0.15s, opacity 0.25s ease;
}
@media (hover: hover) { .sbt-edit:hover { color: var(--accent); opacity: 1; } }
.sbt-edit:focus-visible { color: var(--accent); opacity: 1; }

.sbt--fade .sbt-edit { opacity: 0; pointer-events: none; }

.sbt-aside { flex-shrink: 0; }

</style>
