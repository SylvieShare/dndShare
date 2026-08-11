<template>
  <div class="ps-shelf">
    <div class="ps-head">
      <span class="ps-title">Зелья</span>
      <span v-if="potions.length" class="ps-count">{{ potions.length }}</span>
      <span class="ps-line" aria-hidden="true"></span>
    </div>

    <div class="ps-row">
      <div v-for="p in potions" :key="p.uid" class="ps-vial">
        <RowActionMenu :title="`Действия: ${p.name}`">
          <template #trigger>
            <button class="ps-glasswrap ps-clickable" :title="`Действия: ${p.name}`">
              <PotionVial :ref="el => setVial(p.uid, el)" :color="p.color" :rarity="p.rarity" size="md" />
              <span v-if="p.count > 1" class="ps-badge">×{{ p.count }}</span>
            </button>
          </template>

          <template #default="{ close }">
            <button v-if="canUse" type="button" class="ram-item ram-item--warning" @click="usePotion(p, close)">Использовать</button>
            <button v-if="canAdd" type="button" class="ram-item ram-item--success" @click="replenishPotion(p, close)">Пополнить (+1)</button>
            <button type="button" class="ram-item ram-item--info" @click="viewPotion(p, close)">Просмотреть</button>
          </template>
        </RowActionMenu>

        <span class="ps-name" :title="p.name">{{ p.name }}</span>
      </div>

      <button v-if="canAdd" class="ps-add" title="Добавить зелье" @click="$emit('add')">
        <span class="ps-add-plus">+</span>
        <span class="ps-add-label">зелье</span>
      </button>
    </div>
  </div>
</template>

<script setup>
import PotionVial from '@/features/items/components/PotionVial'
import RowActionMenu from '@/shared/ui/RowActionMenu.vue'

const props = defineProps({
  potions: { type: Array, default: () => [] },
  canUse: { type: Boolean, default: false },
  canAdd: { type: Boolean, default: false },
})
const emit = defineEmits(['use', 'replenish', 'view', 'add'])

const vials = new Map()
const busy = new Set()
function setVial(uid, el) {
  if (el) vials.set(uid, el)
  else vials.delete(uid)
}

async function onUse(p) {
  if (!props.canUse || busy.has(p.uid)) return
  const vial = vials.get(p.uid)
  if (!vial) { emit('use', p.uid); return }
  busy.add(p.uid)
  try {
    const willRefill = p.count > 1
    await vial.playDrain()
    if (willRefill) {
      emit('use', p.uid)
      vial.playRefill()
    } else {
      await vial.playSpent()
      emit('use', p.uid)
    }
  } finally {
    busy.delete(p.uid)
  }
}

async function usePotion(p, close) {
  close()
  await onUse(p)
}

function replenishPotion(p, close) {
  close()
  if (props.canAdd) emit('replenish', p.uid)
}

function viewPotion(p, close) {
  close()
  emit('view', p.uid)
}
</script>

<style scoped>
.ps-shelf {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.ps-head {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 24px;
}
.ps-title {
  color: var(--text-muted);
  font-size: 12px;
  font-weight: 650;
  letter-spacing: 0.08em;
  line-height: 1.15;
  text-transform: uppercase;
}
.ps-count {
  color: var(--text-muted);
  font-size: 12px;
  font-weight: 700;
}
.ps-line {
  flex: 1;
  min-width: 20px;
  height: 1px;
  background: color-mix(in srgb, var(--text-muted) 42%, transparent);
}

.ps-row {
  display: flex;
  flex-wrap: wrap;
  gap: 18px;
  padding: 6px 2px 2px;
}

.ps-vial {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
}

.ps-glasswrap {
  position: relative;
  display: inline-flex;
  background: none;
  border: none;
  padding: 0;
  cursor: default;
}
.ps-glasswrap.ps-clickable { cursor: pointer; }
.ps-clickable:active { transform: translateY(1px); }

.ps-badge {
  position: absolute;
  top: 8px;
  right: -7px;
  min-width: 18px;
  box-sizing: border-box;
  padding: 1px 6px;
  border-radius: var(--r-pill);
  background: var(--surface-raised);
  border: 1px solid var(--border-strong);
  color: var(--text-1);
  font-size: 10px;
  font-weight: 700;
  line-height: 14px;
  text-align: center;
  z-index: 6;
}

.ps-name {
  max-width: 72px;
  font-size: 11px;
  color: var(--text-2);
  text-align: center;
  overflow-wrap: anywhere;
  word-break: break-word;
}

.ps-add {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  width: 42px;
  height: 106px;
  border: 1px dashed var(--border-strong);
  border-radius: var(--r-sm) var(--r-sm) 14px 14px;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  transition: border-color 0.15s, color 0.15s, background 0.15s;
}
.ps-add:hover {
  color: var(--text-2);
  border-color: color-mix(in srgb, var(--accent) 50%, var(--border-strong));
  background: color-mix(in srgb, var(--accent) 5%, transparent);
}
.ps-add-plus { font-size: 18px; line-height: 1; }
.ps-add-label { font-size: 10px; }
</style>
