<template>
  <AppModalFrame :title="mode === 'create' ? 'Новая сессия' : 'Редактировать сессию'" @close="$emit('close')">
    <DndDiarySessionEditor
      :session="session"
      :title-placeholder="titlePlaceholder"
      @update="$emit('update', $event)"
    />

    <template #footer>
      <button v-if="mode === 'edit'" class="ddsm-delete" type="button" @click="$emit('remove')">Удалить</button>
      <div class="ddsm-actions">
        <button class="ddsm-cancel" type="button" @click="$emit('close')">Отмена</button>
        <button class="ddsm-save" type="button" @click="mode === 'create' ? $emit('save') : $emit('close')">
          {{ mode === 'create' ? 'Сохранить' : 'Готово' }}
        </button>
      </div>
    </template>
  </AppModalFrame>
</template>

<script setup>
import AppModalFrame from '@/shared/ui/AppModalFrame.vue'
import DndDiarySessionEditor from '@/features/character-editor/blocks/dnd/components/DndDiarySessionEditor.vue'

defineProps({
  session: { type: Object, required: true },
  titlePlaceholder: { type: String, default: 'Название сессии' },
  mode: { type: String, default: 'edit' },
})
defineEmits(['update', 'remove', 'close', 'save'])
</script>

<style scoped>
.ddsm-actions { display: flex; align-items: center; gap: 10px; }
.ddsm-delete,
.ddsm-cancel,
.ddsm-save { border: none; border-radius: 8px; font: inherit; font-size: 13px; cursor: pointer; }
.ddsm-delete,
.ddsm-cancel { background: none; color: var(--text-muted); padding: 8px 10px; }
.ddsm-delete:hover { color: var(--danger); background: color-mix(in srgb, var(--danger) 12%, transparent); }
.ddsm-cancel:hover { color: var(--text-1); background: var(--surface-raised); }
.ddsm-save { padding: 8px 16px; background: var(--accent); color: var(--text-on-accent); font-weight: 600; }
.ddsm-save:hover { background: var(--accent-hover); }
</style>
