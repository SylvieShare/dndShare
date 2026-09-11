<template>
  <BaseTile v-if="visible" class="last-charge-check" @click.stop @pointerdown.stop>
    <div class="last-charge-heading">
      <SystemDie :sides="Number(check.rule.dice.slice(1))" :value="check.result ?? undefined" :size="32" :animated="false" />
      <div><strong>{{ lost ? 'Магические свойства утрачены' : 'Проверка последнего заряда' }}</strong>
        <p v-if="lost">Выпало {{ check.result }}. Действуют только свойства основы.</p>
        <p v-else>На {{ Number(check.rule.failure_max) === 1 ? '1' : `1–${check.rule.failure_max}` }} предмет становится немагическим.</p>
      </div>
    </div>
    <div v-if="charCtx.ownerMode" class="last-charge-actions">
      <ActionButton v-if="check.status === 'pending'" :loading="busy" @click="roll">Проверить</ActionButton>
      <ActionButton variant="quiet" @click="confirmId = check.id">{{ lost ? 'Отменить утрату магии' : 'Отменить проверку' }}</ActionButton>
    </div>
    <small v-else-if="check.status === 'pending'">Ожидает броска владельца персонажа</small>
    <ConfirmDialog v-if="confirmId" title="Отменить проверку?" message="Отменится только проверка и её последствие. Израсходованные заряды не возвращаются. Используйте это для исправления ошибочного расхода или применения." confirm-text="Отменить проверку" @confirm="undo(confirmId); confirmId = null" @close="confirmId = null" @cancel="confirmId = null" />
  </BaseTile>
</template>
<script setup>
import { computed, inject, ref, toRef } from 'vue'
import { ActionButton, BaseTile, ConfirmDialog } from '@sylvieshare/share-ui'
import SystemDie from '@/shared/ui/SystemDie.vue'
import { useLastChargeCheck } from '../composables/useLastChargeCheck'
const props = defineProps({ uid: { type: String, required: true } })
const charCtx = inject('charCtx', {})
const { entry, check, busy, roll, undo } = useLastChargeCheck(charCtx, toRef(props, 'uid'))
const lost = computed(() => !!entry.value?.params?.magic?.lost)
const visible = computed(() => check.value && (check.value.status === 'pending' || lost.value))
const confirmId = ref(null)
</script>
<style scoped>
.last-charge-check { padding: 12px; display: grid; gap: 10px; cursor: default; }
.last-charge-heading { display: flex; align-items: center; gap: 10px; }
.last-charge-heading > div { min-width: 0; }
.last-charge-heading strong { font-size: 13px; color: var(--text-1); }
.last-charge-heading p { margin: 4px 0 0; font-size: 12px; line-height: 1.4; color: var(--text-2); }
.last-charge-actions { display: flex; flex-wrap: wrap; gap: 6px; }
.last-charge-check > small { color: var(--text-muted); }
</style>
