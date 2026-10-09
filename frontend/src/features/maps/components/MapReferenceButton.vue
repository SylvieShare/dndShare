<template>
  <ActionButton
    icon-only
    variant="secondary"
    aria-label="Справочник тайлов"
    title="Справочник тайлов"
    @click="emit('click')"
    ><template #icon><BookOpenText :size="24" /></template
  ></ActionButton>
</template>
<script setup>
import { ActionButton } from "@sylvieshare/share-ui";
import { BookOpenText } from "@lucide/vue";
const emit = defineEmits(["click"]);
</script>
