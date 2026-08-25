<template>
  <div class="dav" :class="{ 'dav--panel': panel }">
    <SheetBlockTitle
      title="Действия"
      :show-edit="manage"
      :edit-fade="editFade"
      @edit="$emit('manage')"
    />

    <section v-for="group in groups" :key="group.value" class="dav-group" :class="`dav-group--${group.value}`">
      <header class="dav-group-head">
        <component :is="groupIcon(group.value)" :size="15" :stroke-width="2" />
        <span>{{ group.label }}</span>
        <i></i>
      </header>

      <div class="dav-list">
        <RowActionMenu
          v-for="(action, actionIndex) in group.actions"
          :key="action.key"
          block
          :title="`Действия: ${action.title}`"
          :disabled="!manage || (group.actions.length < 2 && action.readonly)"
        >
          <template #trigger="{ open }">
            <article
              class="dav-action action-menu-source"
              :class="{ 'dav-action--divided': actionIndex > 0, 'action-menu-source--open': open }"
            >
              <span class="dav-action-icon" aria-hidden="true">
                <ItemIcon v-if="action.item" :item="action.item" :size="34" :fallback-to-type="false" />
                <component v-else :is="groupIcon(action.action_type)" :size="19" :stroke-width="2" />
              </span>
              <span class="dav-copy">
                <strong>{{ action.title }}</strong>
                <span v-if="action.description" class="dav-description">{{ action.description }}</span>
                <span v-if="linkedActions(action).length" class="dav-linked-actions">
                  <span
                    v-for="linked in linkedActions(action)"
                    :key="linked.code"
                    class="dav-linked-action"
                    @mouseenter="showActionTooltip($event, linked)"
                    @mouseleave="hideActionTooltip"
                  >{{ linked.value }}</span>
                </span>
                <span v-if="action.requirements.length" class="dav-requirements">
                  <span v-for="requirement in action.requirements" :key="requirement">{{ requirement }}</span>
                </span>
              </span>
              <span v-if="action.resource" class="dav-resource" :title="action.resource.title">
                {{ action.resource.value }}/{{ action.resource.total }}
              </span>
            </article>
          </template>

          <template #default="{ close }">
            <RowActionItem v-if="actionIndex > 0" :icon="ArrowUp" @click="move(action, -1, close)">Переместить выше</RowActionItem>
            <RowActionItem v-if="actionIndex < group.actions.length - 1" :icon="ArrowDown" @click="move(action, 1, close)">Переместить ниже</RowActionItem>
            <RowActionSeparator v-if="!action.readonly && group.actions.length > 1" />
            <RowActionItem v-if="!action.readonly" action="edit" @click="edit(action, close)">Редактировать</RowActionItem>
            <RowActionSeparator v-if="!action.readonly" />
            <RowActionItem v-if="!action.readonly" action="delete" tone="danger" @click="remove(action, close)">Удалить</RowActionItem>
          </template>
        </RowActionMenu>

      </div>
    </section>

    <ItemTooltip
      v-if="tooltip.visible"
      :title="tooltip.title"
      :desc="tooltip.desc"
      :x="tooltip.x"
      :top="tooltip.top"
      :bottom="tooltip.bottom"
    />
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { ArrowDown, ArrowUp, RotateCcw, Sparkles, Swords, Wind, Zap } from '@lucide/vue'
import { RowActionMenu } from '@sylvieshare/share-ui'
import ItemIcon from '@/features/items/components/ItemIcon.vue'
import ItemTooltip from '@/features/character-editor/components/ItemTooltip.vue'
import RowActionItem from '@/shared/ui/RowActionItem.vue'
import RowActionSeparator from '@/shared/ui/RowActionSeparator.vue'
import SheetBlockTitle from '@/shared/ui/SheetBlockTitle.vue'

const props = defineProps({
  groups: { type: Array, default: () => [] },
  manage: { type: Boolean, default: false },
  editFade: { type: Boolean, default: false },
  panel: { type: Boolean, default: false },
  actionSuggestions: { type: Array, default: () => [] },
})
const emit = defineEmits(['manage', 'edit', 'move', 'remove'])
const tooltip = ref({ visible: false, title: '', desc: '', x: 0, top: null, bottom: null })
const suggestionsByCode = computed(() => new Map(props.actionSuggestions.map(item => [String(item.code || ''), item])))

function groupIcon(type) {
  return ({
    action: Swords,
    bonus_action: Zap,
    reaction: RotateCcw,
    free: Wind,
    special: Sparkles,
  })[type] || Sparkles
}

function linkedActions(action) {
  return (action.suggest_action_codes || []).map(code => suggestionsByCode.value.get(String(code))).filter(Boolean)
}

function move(action, direction, close) {
  close()
  emit('move', action, direction)
}

function edit(action, close) {
  close()
  emit('edit', action)
}

function remove(action, close) {
  close()
  emit('remove', action)
}

function showActionTooltip(event, item) {
  if (!item?.desc) return
  const rect = event.currentTarget.getBoundingClientRect()
  const above = window.innerHeight - rect.bottom < 180
  tooltip.value = {
    visible: true,
    title: item.value,
    desc: item.desc,
    x: Math.max(8, Math.min(rect.left, window.innerWidth - 380)),
    top: above ? null : rect.bottom + 8,
    bottom: above ? window.innerHeight - rect.top + 8 : null,
  }
}

function hideActionTooltip() {
  tooltip.value.visible = false
}
</script>

<style scoped>
.dav { display: flex; min-width: 0; flex-direction: column; gap: 13px; padding: 11px 12px 12px; box-sizing: border-box; }
.dav--panel { padding-right: 14px; }
.dav-group { --dav-tone: var(--accent); display: flex; flex-direction: column; gap: 5px; }
.dav-group--bonus_action { --dav-tone: var(--info); }
.dav-group--reaction { --dav-tone: var(--warning); }
.dav-group--free { --dav-tone: var(--success); }
.dav-group-head { display: grid; grid-template-columns: auto auto minmax(12px, 1fr); gap: 6px; align-items: center; color: var(--dav-tone); font-size: 9px; font-weight: 800; letter-spacing: .065em; text-transform: uppercase; }
.dav-group-head i { height: 1px; background: color-mix(in srgb, var(--dav-tone) 24%, transparent); }
.dav-list { display: flex; flex-direction: column; }
.dav-action { display: grid; grid-template-columns: 36px minmax(0, 1fr) auto; gap: 9px; align-items: start; padding: 10px 2px; cursor: pointer; transition: background-color .12s; }
.dav-action--divided { border-top: 1px solid var(--border); }
.dav-action:hover, .dav-action.action-menu-source--open { background: color-mix(in srgb, var(--dav-tone) 5%, transparent); }
.dav-action-icon { display: grid; width: 36px; height: 36px; place-items: center; overflow: hidden; color: var(--dav-tone); }
.dav-action-icon :deep(.item-icon) { width: 34px; height: 34px; }
.dav-copy { display: flex; min-width: 0; flex-direction: column; gap: 3px; }
.dav-copy strong { color: var(--text-1); font-size: 12px; line-height: 1.25; }
.dav-description { color: var(--text-2); font-size: 10px; line-height: 1.4; }
.dav-linked-actions { display: flex; flex-wrap: wrap; gap: 4px 8px; margin-top: 1px; }
.dav-linked-action { color: var(--dav-tone); font-size: 10px; font-weight: 750; text-decoration: underline dotted; text-underline-offset: 3px; }
.dav-requirements { display: flex; flex-direction: column; gap: 2px; margin-top: 2px; color: var(--text-muted); font-size: 9px; line-height: 1.35; }
.dav-requirements > span::before { margin-right: 5px; color: var(--dav-tone); content: '•'; }
.dav-resource { align-self: center; padding: 3px 5px; border-radius: 5px; background: color-mix(in srgb, var(--dav-tone) 12%, transparent); color: var(--dav-tone); font-size: 10px; font-weight: 800; }
</style>
