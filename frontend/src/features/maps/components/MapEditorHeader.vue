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
        <h1>{{ editor.draft.name }}</h1>
      </div>
    </template>
    <template #actions>
      <MapReferenceButton v-if="admin" @click="emit('reference')" />
    </template>
  </WorkspaceHeader>
</template>
<script setup>
import { ActionButton } from "@sylvieshare/share-ui";
import { ArrowLeft } from "@lucide/vue";
import WorkspaceHeader from "@/shared/ui/WorkspaceHeader.vue";
import MapReferenceButton from "./MapReferenceButton.vue";
defineProps({ editor: Object, admin: Boolean });
const emit = defineEmits(["close", "reference"]);
</script>
