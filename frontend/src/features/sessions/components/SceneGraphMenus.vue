<template>
  <BasePopover v-model:open="open" :anchor="anchor" :min-width="210" placement="bottom-start">
    <div v-if="scene" class="scene-graph-menu">
      <RowActionItem v-if="context === 'ancestor'" :icon="ArrowLeft" tone="accent" @click="run('return-scenes', scene)">Вернуться к сценариям</RowActionItem>
      <template v-else>
        <RowActionItem :icon="MonitorPlay" tone="accent" @click="run('present', scene)">Запустить сцену</RowActionItem>
        <RowActionItem action="view" tone="accent" @click="run('open-scene', scene)">Открыть элементы</RowActionItem>
      </template>
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
      <RowActionItem v-if="context !== 'ancestor'" action="delete" tone="danger" @click="run('delete', scene)">Удалить</RowActionItem>
    </div>
  </BasePopover>
</template>

<script setup>
import { ref } from 'vue'
import { ArrowLeft, Check, Circle, ListChecks, MonitorPlay } from '@lucide/vue'
import { BasePopover, RowActionSubmenu } from '@sylvieshare/share-ui'
import RowActionItem from '@/shared/ui/RowActionItem.vue'
import { SCENE_STATUSES } from '@/features/sessions/lib/chapterGraph'

const emit = defineEmits(['open-scene', 'status', 'edit', 'delete', 'present', 'return-scenes'])
const open = ref(false)
const anchor = ref(null)
const scene = ref(null)
const context = ref('node')

function openFor(nextScene, nextAnchor, nextContext = 'node') {
  scene.value = nextScene
  anchor.value = nextAnchor
  context.value = nextContext
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
