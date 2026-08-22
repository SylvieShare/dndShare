<template>
  <div class="dav" :class="{ 'dav--panel': panel }">
    <SheetBlockTitle
      title="Действия"
      :show-edit="manage"
      :edit-fade="editFade"
      @edit="$emit('manage')"
    />

    <div v-if="!groups.length" class="dav-empty">Добавьте своё действие или получите его от способности.</div>

    <section v-for="group in groups" :key="group.value" class="dav-group" :class="`dav-group--${group.value}`">
      <header class="dav-group-head">
        <component :is="groupIcon(group.value)" :size="15" :stroke-width="2" />
        <span>{{ group.label }}</span>
        <i></i>
      </header>

      <article v-for="action in group.actions" :key="action.key" class="dav-action">
        <span class="dav-action-icon" aria-hidden="true">
          <component :is="groupIcon(action.action_type)" :size="18" :stroke-width="2" />
        </span>
        <span class="dav-copy">
          <strong>{{ action.title }}</strong>
          <span v-if="action.description" class="dav-description">{{ action.description }}</span>
          <small v-if="action.source_label">Источник: {{ action.source_label }}</small>
          <span v-if="action.requirements.length" class="dav-requirements">
            <span v-for="requirement in action.requirements" :key="requirement">{{ requirement }}</span>
          </span>
        </span>
        <span v-if="action.resource" class="dav-resource" :title="action.resource.title">
          {{ action.resource.value }}/{{ action.resource.total }}
        </span>
        <button
          v-if="manage"
          type="button"
          class="dav-use"
          :disabled="!canUse(action)"
          @click="$emit('use', action)"
        >Использовать</button>
      </article>
    </section>
  </div>
</template>

<script setup>
import { RotateCcw, Sparkles, Swords, Wind, Zap } from '@lucide/vue'
import SheetBlockTitle from '@/shared/ui/SheetBlockTitle.vue'

defineProps({
  groups: { type: Array, default: () => [] },
  manage: { type: Boolean, default: false },
  editFade: { type: Boolean, default: false },
  panel: { type: Boolean, default: false },
})
defineEmits(['manage', 'use'])

function groupIcon(type) {
  return ({
    action: Swords,
    bonus_action: Zap,
    reaction: RotateCcw,
    free: Wind,
    special: Sparkles,
  })[type] || Sparkles
}

function canUse(action) {
  if (!action.resource || action.resource.unlimited) return true
  return Number(action.resource.value) >= Math.max(1, Number(action.resource_cost) || 1)
}
</script>

<style scoped>
.dav { display: flex; min-width: 0; flex-direction: column; gap: 10px; padding: 11px 12px 12px; box-sizing: border-box; }
.dav--panel { padding-right: 14px; }
.dav-empty { padding: 2px 1px 4px; color: var(--text-muted); font-size: 11px; line-height: 1.4; }
.dav-group { --dav-tone: var(--accent); display: flex; flex-direction: column; gap: 6px; }
.dav-group--bonus_action { --dav-tone: var(--info); }
.dav-group--reaction { --dav-tone: var(--warning); }
.dav-group--free { --dav-tone: var(--success); }
.dav-group-head { display: grid; grid-template-columns: auto auto minmax(12px, 1fr); gap: 6px; align-items: center; color: var(--dav-tone); font-size: 9px; font-weight: 800; letter-spacing: .065em; text-transform: uppercase; }
.dav-group-head i { height: 1px; background: color-mix(in srgb, var(--dav-tone) 24%, transparent); }
.dav-action { display: grid; grid-template-columns: 32px minmax(0, 1fr) auto; gap: 8px; align-items: start; padding: 9px; border: 1px solid color-mix(in srgb, var(--dav-tone) 20%, var(--border)); border-radius: 9px; background: color-mix(in srgb, var(--dav-tone) 5%, var(--surface-raised)); }
.dav-action-icon { display: grid; width: 32px; height: 32px; place-items: center; border-radius: 8px; background: color-mix(in srgb, var(--dav-tone) 13%, transparent); color: var(--dav-tone); }
.dav-copy { display: flex; min-width: 0; flex-direction: column; gap: 3px; }
.dav-copy strong { color: var(--text-1); font-size: 12px; line-height: 1.25; }
.dav-description { color: var(--text-2); font-size: 10px; line-height: 1.4; }
.dav-copy small { color: var(--text-muted); font-size: 9px; }
.dav-requirements { display: flex; flex-direction: column; gap: 2px; margin-top: 2px; color: var(--text-muted); font-size: 9px; line-height: 1.35; }
.dav-requirements > span::before { margin-right: 5px; color: var(--dav-tone); content: '•'; }
.dav-resource { align-self: center; padding: 3px 5px; border-radius: 5px; background: color-mix(in srgb, var(--dav-tone) 12%, transparent); color: var(--dav-tone); font-size: 10px; font-weight: 800; }
.dav-use { grid-column: 2 / -1; justify-self: start; min-height: 28px; padding: 5px 8px; border: 1px solid color-mix(in srgb, var(--dav-tone) 35%, transparent); border-radius: 7px; background: transparent; color: var(--dav-tone); cursor: pointer; font: inherit; font-size: 9px; font-weight: 750; }
.dav-use:hover:not(:disabled) { background: color-mix(in srgb, var(--dav-tone) 10%, transparent); }
.dav-use:disabled { cursor: default; opacity: .4; }
</style>
