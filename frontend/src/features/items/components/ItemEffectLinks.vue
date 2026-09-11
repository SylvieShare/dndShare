<template>
  <HandbookReferenceRows v-if="rows.length" split :rows="rows" :z-index="zIndex">
    <template #info="{ row }">
      <div class="effect-application">
        <span class="effect-application-target"><Crosshair :size="14" />{{ row.link.target === 'other' ? 'На цель' : 'На владельца' }}</span>
        <div v-if="row.damage" class="effect-application-rule">
          <small>Применение</small><strong>{{ row.damage.label || 'Дополнительный урон' }}</strong>
          <span v-if="row.damage.uses_resource || row.damage.resource_key" class="effect-application-cost">−{{ row.damage.resource_cost ?? 1 }} <SpellSlotSphere :size="20" :interactive="false" />{{ resourceTitle(row.damage) }}</span>
        </div>
        <div v-if="row.link.condition"><small>Когда накладывается</small><MechanicTheses :lines="conditions(row.link.condition)" /></div>
      </div>
    </template>
    <template #description="{ item: effect }"><MechanicTheses v-if="effect?.data?.desc" :html="effect.data.desc" /></template>
  </HandbookReferenceRows>
</template>
<script setup>
import { computed } from 'vue'
import { Crosshair } from '@lucide/vue'
import HandbookReferenceRows from './HandbookReferenceRows.vue'
import SpellSlotSphere from './SpellSlotSphere.vue'
import MechanicTheses from '@/shared/ui/MechanicTheses.vue'
import { statusEffectLinks } from '@/features/character-editor/lib/characterStatuses'
const props = defineProps({ item: Object, zIndex: { type: Number, default: 5100 } })
const rows = computed(() => statusEffectLinks(props.item).map(link => ({ id: link.effect_id, key: link.key, link,
  damage: (props.item?.data?.weapon_damage || []).find(rule => rule.key === link.weapon_damage_key),
})))
const conditions = value => String(value).split(/;\s*|\n+/).map(row => row.trim()).filter(Boolean)
function resourceTitle(rule) { return rule.resource_key ? (props.item?.data?.use_resources || []).find(row => row.key === rule.resource_key)?.title || 'Ресурс предмета' : 'Заряд' }
</script>
<style scoped>
.effect-application { display: grid; gap: 10px; padding: 3px 0 3px 10px; border-left: 2px solid var(--border-strong); }
.effect-application-target { display: inline-flex; align-items: center; gap: 6px; color: var(--accent-soft); font-size: 12px; font-weight: 650; }
.effect-application small { display: block; color: var(--text-muted); font-size: 10px; letter-spacing: .03em; }
.effect-application-rule { display: grid; gap: 3px; }
.effect-application-rule strong { font-size: 12px; color: var(--text-1); }
.effect-application-cost { display: inline-flex; align-items: center; gap: 4px; font-size: 11px; color: var(--text-2); }
</style>
