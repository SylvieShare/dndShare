<template>
  <div class="rest-block">
    <BaseTile class="rest-tile" :color="SHORT_COLOR">
      <DndRestView :interactive="ownerMode" @short="onShort" @long="onLong" />
    </BaseTile>

    <AppModal v-if="shortOpen" tile @close="shortOpen = false">
      <DndShortRestEditor
        :hp="hp"
        :die-label="dieLabel"
        :con-mod="conMod"
        @spend="spendDie"
        @finish="finishShort"
      />
    </AppModal>

    <ConfirmDialog
      v-if="confirmLong"
      title="Длинный отдых"
      message="Восстановит все хиты, ячейки заклинаний и ресурсы, вернёт часть костей хитов и снизит истощение на 1."
      confirm-label="Отдохнуть"
      cancel-label="Отмена"
      variant="warning"
      @confirm="applyLong"
      @cancel="confirmLong = false"
    />
  </div>
</template>

<script setup>
import { computed, inject, ref } from 'vue'
import AppModal from '@/shared/ui/AppModal'
import BaseTile from '@/shared/ui/BaseTile'
import ConfirmDialog from '@/shared/ui/ConfirmDialog'
import DndRestView from '@/features/character-editor/blocks/dnd/components/DndRestView'
import DndShortRestEditor from '@/features/character-editor/blocks/dnd/components/DndShortRestEditor'
import { useDiceStore } from '@/stores/dice'
import {
  exhaustionLevel,
  longRestExhaustion,
  longRestHp,
  longRestSpells,
  restResources,
  shortRestSpells,
  spendHitDie,
  statMod,
} from '@/features/character-editor/blocks/dnd/lib/rest'

const SHORT_COLOR = '#ca9a4a'

const props = defineProps(['block', 'values'])
const emit = defineEmits(['update:value'])
const charCtx = inject('charCtx', { ownerMode: true })
const dice = useDiceStore()

const shortOpen = ref(false)
const confirmLong = ref(false)

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
const dieLabel = computed(() => hp.value.dice || 'd8')
const conMod = computed(() => statMod(props.values?.[ids.value.con]))

function onShort() {
  if (!ownerMode.value) return
  shortOpen.value = true
}

function onLong() {
  if (!ownerMode.value) return
  confirmLong.value = true
}

function spendDie() {
  const sides = parseInt(String(dieLabel.value).replace(/\D/g, ''), 10) || 8
  const mod = conMod.value
  const expr = `1d${sides}${mod >= 0 ? '+' + mod : mod}`
  const result = dice.roll('Кость хитов', expr)
  emit('update:value', ids.value.hp, spendHitDie(hp.value, result?.total ?? 0))
}

function finishShort() {
  emit('update:value', ids.value.resources, restResources(props.values?.[ids.value.resources], 'short'))
  const spells = props.values?.[ids.value.spells]
  if (spells && typeof spells === 'object') {
    const next = shortRestSpells(spells)
    if (next !== spells) emit('update:value', ids.value.spells, next)
  }
  shortOpen.value = false
}

function applyLong() {
  const i = ids.value
  emit('update:value', i.hp, longRestHp(hp.value))
  const spells = props.values?.[i.spells]
  if (spells && typeof spells === 'object') emit('update:value', i.spells, longRestSpells(spells))
  emit('update:value', i.resources, restResources(props.values?.[i.resources], 'long'))
  const ex = props.values?.[i.exhaustion]
  if (exhaustionLevel(ex) > 0) emit('update:value', i.exhaustion, longRestExhaustion(ex))
  confirmLong.value = false
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
