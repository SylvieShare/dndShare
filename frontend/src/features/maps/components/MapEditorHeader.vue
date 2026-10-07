<template>
  <WorkspaceHeader class="map-workspace-header">
    <template #identity>
      <ActionButton
        variant="quiet"
        aria-label="Закрыть редактор"
        @click="emit('close')"
      >
        <template #icon><ArrowLeft :size="18" /></template>
        Карты
      </ActionButton>
      <div class="map-editor-heading">
        <h1>Редактор карты</h1>
        <span>{{ editor.draft.name }}</span>
      </div>
    </template>
    <template #navigation><MapEditorActions :editor="editor" /></template>
    <template #actions>
      <ActionButton
        v-if="admin"
        icon-only
        variant="secondary"
        aria-label="Справочник тайлов"
        title="Справочник тайлов"
        @click="emit('reference')"
      >
        <template #icon><BookOpenText :size="24" /></template>
      </ActionButton>
    </template>
  </WorkspaceHeader>
</template>
<script setup>
import { ActionButton } from "@sylvieshare/share-ui";
import { ArrowLeft, BookOpenText } from "@lucide/vue";
import WorkspaceHeader from "@/shared/ui/WorkspaceHeader.vue";
import MapEditorActions from "./MapEditorActions.vue";
defineProps({ editor: Object, admin: Boolean });
const emit = defineEmits(["close", "reference"]);
</script>
