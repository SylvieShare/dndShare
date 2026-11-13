<template>
  <BasePopover :open="open" :anchor="anchor" :z-index="4200" role="dialog" :aria-label="details.label"
    transition-preset="action-menu" @update:open="$emit('update:open', $event)">
    <section class="passive-details">
      <header>
        <component :is="details.icon" :size="layoutTokens['sheet-header-action-icon']" aria-hidden="true" />
        <div><small>Пассивная проверка</small><strong>{{ details.title }}</strong><span>{{ details.ability }}</span></div>
        <b>{{ value }}</b>
      </header>
      <p>{{ details.description }}</p>
      <div class="passive-formula"><span>10 + бонус навыка</span><strong>10 {{ signed(value - 10) }} = {{ value }}</strong></div>
      <small>Используется без броска костей. Мастер определяет, когда применить это значение.</small>
    </section>
  </BasePopover>
</template>
<script setup>
import { computed } from 'vue'
import { BasePopover } from '@sylvieshare/share-ui'
import { Eye, Search } from '@lucide/vue'
import { layoutTokens } from '@/app/design-tokens'
import { formatBonus as signed } from '@/shared/lib/dnd'
const props = defineProps({ open: Boolean, kind: String, anchor: Object, value: Number })
defineEmits(['update:open'])
const details = computed(() => props.kind === 'perception'
  ? { label: 'Пассивное внимание', title: 'Внимательность', ability: 'Мудрость', icon: Eye,
    description: 'Помогает заметить скрытое существо, опасность или важную деталь без активного поиска.' }
  : { label: 'Пассивное расследование', title: 'Анализ', ability: 'Интеллект', icon: Search,
    description: 'Помогает распознать закономерность, сопоставить улики и сделать вывод без отдельной активной проверки.' })
</script>
<style scoped>
.passive-details {display:grid;gap:var(--spacing-label);box-sizing:border-box;width:var(--layout-roll-mode-menu-width);max-width:calc(100vw - 32px);padding:var(--spacing-large);color:var(--text-2);font-size:var(--type-group-size);line-height:var(--type-group-line-height)}
.passive-details header {display:flex;align-items:center;gap:var(--spacing-small);color:var(--accent-soft)}
.passive-details header>div {display:grid;gap:2px;flex:1;min-width:0}
.passive-details header strong {color:var(--text-1)}
.passive-details header b {font-size:var(--type-weapon-damage-value-size);line-height:var(--type-weapon-damage-value-line-height)}
.passive-details p {margin:0}
.passive-details small,.passive-details header span,.passive-formula>span {color:var(--text-muted);font-size:var(--type-context-size);line-height:var(--type-context-line-height)}
.passive-formula {display:grid;gap:var(--spacing-xs);padding:var(--spacing-small);border-radius:var(--radius-input);background:var(--surface-raised)}
.passive-formula strong {color:var(--text-1);font-variant-numeric:lining-nums tabular-nums}
</style>
