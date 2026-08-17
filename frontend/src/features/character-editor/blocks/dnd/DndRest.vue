<template>
  <div class="rest-block">
    <BaseTile class="rest-tile" :color="SHORT_COLOR">
      <DndRestView :interactive="ownerMode" @short="onShort" @long="onLong" />
    </BaseTile>

    <AppModalFrame v-if="shortOpen" title="Короткий отдых" @close="shortOpen = false">
      <DndShortRestEditor
        :hp="hp"
        :con-mod="conMod"
        @spend="spendDie"
        @finish="finishShort"
      />
    </AppModalFrame>

    <AppModalFrame v-if="longOpen" title="Длинный отдых" @close="longOpen = false">
      <DndLongRestEditor
        :hp="hp"
        :recovery-count="longRestRecoveryCount(hp)"
        @confirm="applyLong"
        @cancel="longOpen = false"
      />
    </AppModalFrame>
  </div>
</template>

<script setup>
import { computed, inject, ref } from 'vue'
import { AppModalFrame } from '@sylvieshare/share-ui'
import { BaseTile } from '@sylvieshare/share-ui'
import DndLongRestEditor from '@/features/character-editor/blocks/dnd/components/DndLongRestEditor'
import DndRestView from '@/features/character-editor/blocks/dnd/components/DndRestView'
import DndShortRestEditor from '@/features/character-editor/blocks/dnd/components/DndShortRestEditor'
import { useDiceStore } from '@/stores/dice'
import {
  exhaustionLevel,
  longRestExhaustion,
  longRestHp,
  longRestRecoveryCount,
  longRestSpells,
  restResources,
  shortRestSpells,
  spendHitDie,
  statMod,
} from '@/features/character-editor/blocks/dnd/lib/rest'
import { normalizeHitDice } from '@/features/character-editor/blocks/dnd/lib/hitDice'

const SHORT_COLOR = 'var(--warning)'

const props = defineProps(['block', 'values'])
const emit = defineEmits(['update:value'])
const charCtx = inject('charCtx', { ownerMode: true })
const dice = useDiceStore()

const shortOpen = ref(false)
const longOpen = ref(false)
const shortStart = ref(null)

const ownerMode = computed(() => charCtx.ownerMode)

const ids = computed(() => {
  const c = props.block?.content || {}
  return {
    hp: c.hp_id || 'hp',
    spells: c.spells_id || 'spells',
    resources: c.resources_id || 'resources',
    exhaustion: c.exhaustion_id || 'exhaustion',
    con: c.con_id || 'CON',
  }
})

const hp = computed(() => props.values?.[ids.value.hp] || {})
const conMod = computed(() => statMod(props.values?.[ids.value.con]))

function onShort() {
  if (!ownerMode.value) return
  shortStart.value = {
    hp: Number(hp.value.current) || 0,
    hitDice: normalizeHitDice(hp.value).map(pool => ({ die: pool.die, used: pool.used })),
  }
  shortOpen.value = true
}

function onLong() {
  if (!ownerMode.value) return
  longOpen.value = true
}

function spendDie(die) {
  const sides = parseInt(String(die).replace(/\D/g, ''), 10) || 8
  const mod = conMod.value
  const expr = `1d${sides}${mod >= 0 ? '+' + mod : mod}`
  const result = dice.roll(`Кость хитов ${die}`, expr)
  emit('update:value', ids.value.hp, spendHitDie(hp.value, result?.total ?? 0, die))
}

function finishShort() {
  const previousResources = props.values?.[ids.value.resources]
  const nextResources = restResources(previousResources, 'short')
  emit('update:value', ids.value.resources, nextResources)
  const spells = props.values?.[ids.value.spells]
  if (spells && typeof spells === 'object') {
    const next = shortRestSpells(spells)
    if (next !== spells) emit('update:value', ids.value.spells, next)
  }
  const currentPools = normalizeHitDice(hp.value)
  const hitDiceSpent = (shortStart.value?.hitDice || []).map(before => {
    const after = currentPools.find(pool => pool.die === before.die)
    return { die: before.die, count: Math.max(0, (after?.used || 0) - before.used) }
  }).filter(pool => pool.count > 0)
  charCtx.logSessionEvent?.({
    type: 'rest_completed',
    action: 'Короткий отдых',
    data: {
      kind: 'short',
      hpRecovered: Math.max(0, (Number(hp.value.current) || 0) - (shortStart.value?.hp || 0)),
      hitDiceSpent,
      resourcesRecovered: recoveredResourceNames(previousResources, nextResources),
    },
  })
  shortOpen.value = false
}

function applyLong(recovery) {
  const i = ids.value
  const recoveredCount = longRestRecoveryCount(hp.value)
  emit('update:value', i.hp, longRestHp(hp.value, recovery))
  const spells = props.values?.[i.spells]
  if (spells && typeof spells === 'object') emit('update:value', i.spells, longRestSpells(spells))
  emit('update:value', i.resources, restResources(props.values?.[i.resources], 'long'))
  const ex = props.values?.[i.exhaustion]
  if (exhaustionLevel(ex) > 0) emit('update:value', i.exhaustion, longRestExhaustion(ex))
  charCtx.logSessionEvent?.({
    type: 'rest_completed',
    action: 'Длинный отдых',
    data: {
      kind: 'long',
      hpRecovered: Math.max(0, (Number(hp.value.max) || 0) - (Number(hp.value.current) || 0)),
      hitDiceRecovered: recoveredCount,
      resourcesRecovered: recoveredResourceNames(props.values?.[i.resources], restResources(props.values?.[i.resources], 'long')),
    },
  })
  longOpen.value = false
}

function recoveredResourceNames(before, after) {
  if (!Array.isArray(before) || !Array.isArray(after)) return []
  return after
    .filter((resource, index) => Number(resource.value) > Number(before[index]?.value))
    .map(resource => resource.title || 'Ресурс')
}
</script>

<style scoped>
.rest-block { min-width: 0; }

.rest-tile {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 80px;
  overflow: hidden;
}
</style>
