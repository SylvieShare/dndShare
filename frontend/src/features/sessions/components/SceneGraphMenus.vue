<template>
  <BasePopover v-model:open="open" :anchor="anchor" :min-width="210" placement="bottom-start">
    <div v-if="scene" class="scene-graph-menu">
      <RowActionItem :icon="MonitorPlay" tone="accent" @click="run('present', scene)">Запустить сцену</RowActionItem>
      <RowActionItem action="view" tone="accent" @click="run('open-scene', scene)">Открыть элементы</RowActionItem>
      <RowActionSubmenu label="Статус сценария" :min-width="230">
        <template #trigger="{ open: submenuOpen }">
          <RowActionItem :icon="ListChecks" submenu :submenu-open="submenuOpen">Изменить статус</RowActionItem>
        </template>
        <RowActionItem
          v-for="status in SCENE_STATUSES"
          :key="status.key"
          :icon="scene.status === status.key ? Check : Circle"
          :style="{ color: status.color }"
          @click="changeStatus(status.key)"
        >{{ status.label }}</RowActionItem>
      </RowActionSubmenu>
      <RowActionItem action="edit" @click="run('edit', scene)">Редактировать</RowActionItem>
      <RowActionItem action="delete" tone="danger" @click="run('delete', scene)">Удалить</RowActionItem>
    </div>
  </BasePopover>
</template>

<script setup>
import { ref } from 'vue'
import { Check, Circle, ListChecks, MonitorPlay } from '@lucide/vue'
import { BasePopover, RowActionSubmenu } from '@sylvieshare/share-ui'
import RowActionItem from '@/shared/ui/RowActionItem.vue'
import { SCENE_STATUSES } from '@/features/sessions/lib/chapterGraph'

const emit = defineEmits(['open-scene', 'status', 'edit', 'delete', 'present'])
const open = ref(false)
const anchor = ref(null)
const scene = ref(null)

function openFor(nextScene, nextAnchor) {
  scene.value = nextScene
  anchor.value = nextAnchor
  open.value = true
}

function close() {
  open.value = false
}

function run(event, value) {
  close()
  emit(event, value)
}

function changeStatus(status) {
  const activeScene = scene.value
  close()
  emit('status', activeScene, status)
}

defineExpose({ openFor, close })
</script>

<style scoped>
.scene-graph-menu { display: flex; min-width: 200px; flex-direction: column; gap: 2px; padding: 5px; }
</style>
