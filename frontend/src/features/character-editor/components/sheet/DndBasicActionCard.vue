<template>
  <BaseTile :outlined="false" :color="color" :tint="compact" class="basic-action-tile">
    <ActionButton variant="quiet" class="basic-action-button" :aria-label="entry.title" @click="emit('open', entry.id)">
      <span class="basic-action-content" :class="{ 'basic-action-content--compact': compact }">
        <span class="basic-action-icon" :style="{ color }"><component :is="icons[entry.icon]" aria-hidden="true" /></span>
        <span class="basic-action-copy"><strong>{{ entry.title }}</strong><small>{{ entry.summary }}</small></span>
        <ChevronRight v-if="!compact" class="basic-action-chevron" aria-hidden="true" />
      </span>
    </ActionButton>
  </BaseTile>
</template>
<script setup>
import { computed } from 'vue'
import { ActionButton, BaseTile } from '@sylvieshare/share-ui'
import { BookOpen, ChevronRight, DoorOpen, EyeOff, Footprints, HandHelping, Hourglass, Lightbulb, MessageCircle, PackageOpen, Search, Shield, Sparkles, Swords, Zap } from '@lucide/vue'
const props = defineProps({ entry: { type: Object, required: true }, compact: Boolean })
const emit = defineEmits(['open'])
const color = computed(() => `var(--${props.entry.tone})`)
const icons = { swords: Swords, footprints: Footprints, sparkles: Sparkles, zap: Zap, exit: DoorOpen, shield: Shield, help: HandHelping, 'eye-off': EyeOff, hourglass: Hourglass, search: Search, book: BookOpen, message: MessageCircle, package: PackageOpen, idea: Lightbulb }
</script>
<style scoped>
.basic-action-tile { min-width: 0; display: flex; }
.basic-action-button { width: 100%; display: grid; justify-content: stretch; text-align: left; padding: var(--spacing-large); border-radius: var(--radius-tile); }
.basic-action-content { display: flex; align-items: center; gap: var(--spacing-medium); }
.basic-action-icon { display: grid; place-items: center; flex: 0 0 var(--layout-touch-min); height: var(--layout-touch-min); border-radius: var(--radius-input); background: color-mix(in srgb, currentColor 10%, transparent); }
.basic-action-icon svg { width: var(--layout-workspace-navigation-icon); height: var(--layout-workspace-navigation-icon); }
.basic-action-copy { display: grid; gap: var(--spacing-xs); min-width: 0; }
.basic-action-copy strong { color: var(--text-1); font-size: var(--type-group-size); line-height: var(--type-group-line-height); }
.basic-action-copy small { color: var(--text-muted); font-size: var(--type-group-size); line-height: 1.5; font-weight: 400; }
.basic-action-chevron { flex: 0 0 var(--type-group-size); width: var(--type-group-size); color: var(--text-muted); margin-left: auto; }
.basic-action-content--compact { align-items: flex-start; flex-direction: column; }
.basic-action-content--compact .basic-action-icon { flex-basis: auto; height: var(--layout-workspace-navigation-icon); background: transparent; }
</style>
