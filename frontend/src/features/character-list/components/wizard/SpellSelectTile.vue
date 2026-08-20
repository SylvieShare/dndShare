<template>
  <div class="spell-tile" :class="{ 'spell-tile--selected': selected, 'spell-tile--disabled': disabled, 'spell-tile--readonly': readonly }">
    <button
      type="button"
      class="spell-tile-body"
      :disabled="disabled || readonly"
      :aria-pressed="selected"
      @click="$emit('select')"
    >
      <span class="spell-tile-icon" aria-hidden="true">
        <ItemIcon v-if="spell.iconImageUrl || spell.svg" :item="spell" :size="38" />
        <Sparkles v-else :size="22" />
      </span>
      <span class="spell-tile-copy">
        <strong>{{ spell.name }}</strong>
        <span class="spell-tile-meta">{{ meta }}</span>
        <span v-if="details" class="spell-tile-details">{{ details }}</span>
      </span>
      <span class="spell-tile-choice" :class="{ 'spell-tile-choice--selected': selected }" aria-hidden="true">
        <Check v-if="selected" :size="13" />
      </span>
    </button>
    <button
      type="button"
      class="spell-tile-view"
      :title="`Открыть «${spell.name}» в справочнике`"
      :aria-label="`Открыть «${spell.name}» в справочнике`"
      @click.stop="$emit('details')"
    >
      <CircleHelp :size="17" aria-hidden="true" />
    </button>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { Check, CircleHelp, Sparkles } from '@lucide/vue'
import ItemIcon from '@/features/items/components/ItemIcon.vue'

const props = defineProps({
  spell: { type: Object, required: true },
  school: { type: String, default: '' },
  selected: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false },
  readonly: { type: Boolean, default: false },
})
defineEmits(['select', 'details'])

const data = computed(() => props.spell.data || {})
const circle = computed(() => Number(data.value.lvl) === 0 ? 'Заговор' : `${data.value.lvl} круг`)
const meta = computed(() => [circle.value, props.school].filter(Boolean).join(' · '))
const details = computed(() => [data.value.time, data.value.range].filter(Boolean).join(' · '))
</script>

<style scoped>
.spell-tile {
  min-width: 0; display: flex; align-items: stretch; border: 1px solid var(--border);
  border-radius: var(--r-md); background: var(--surface); color: var(--text-1);
  transition: transform .15s ease, border-color .15s ease, background .15s ease;
}
.spell-tile:hover:not(.spell-tile--disabled):not(.spell-tile--readonly) { transform: translateY(-1px); border-color: color-mix(in srgb, var(--accent) 46%, var(--border)); background: color-mix(in srgb, var(--accent) 7%, var(--surface)); }
.spell-tile--selected { border-color: color-mix(in srgb, var(--accent) 66%, var(--border)); background: color-mix(in srgb, var(--accent) 11%, var(--surface)); }
.spell-tile--disabled { opacity: .5; }
.spell-tile-body { min-width: 0; flex: 1; display: flex; align-items: center; gap: 10px; padding: 10px 3px 10px 10px; border: 0; background: transparent; color: inherit; font: inherit; text-align: left; cursor: pointer; }
.spell-tile-body:disabled { cursor: default; }
.spell-tile--readonly { transform: none; }
.spell-tile-body:focus-visible, .spell-tile-view:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.spell-tile-icon { width: 42px; height: 42px; flex: none; display: grid; place-items: center; border-radius: 50%; background: color-mix(in srgb, var(--accent) 13%, var(--surface-raised)); color: var(--accent); }
.spell-tile-copy { min-width: 0; flex: 1; display: flex; flex-direction: column; gap: 2px; }
.spell-tile-copy strong { overflow: hidden; color: var(--text-1); font-size: 12px; font-weight: 700; line-height: 1.25; text-overflow: ellipsis; white-space: nowrap; }
.spell-tile-meta { color: var(--accent-soft); font-size: 9px; font-weight: 650; line-height: 1.2; }
.spell-tile-details { overflow: hidden; color: var(--text-muted); font-size: 9px; line-height: 1.2; text-overflow: ellipsis; white-space: nowrap; }
.spell-tile-choice { width: 17px; height: 17px; flex: none; display: grid; place-items: center; border: 1px solid var(--border-strong); border-radius: 50%; color: var(--text-on-accent); }
.spell-tile-choice--selected { border-color: var(--accent); background: var(--accent); }
.spell-tile-view { width: 31px; flex: none; display: grid; place-items: center; margin: 6px 6px 6px 0; padding: 0; border: 0; border-radius: 50%; background: transparent; color: var(--text-muted); cursor: pointer; transition: color .15s, background .15s; }
.spell-tile-view:hover { background: color-mix(in srgb, var(--accent) 13%, transparent); color: var(--accent); }
</style>
