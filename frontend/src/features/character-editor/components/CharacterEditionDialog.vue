<template>
  <AppModalFrame v-if="controller.open && controller.available" title="Редакция персонажа" :dismissible="!controller.busy" @close="close">
    <p class="edition-intro">Выберите редакцию правил для этого персонажа.</p>
    <div class="edition-list" role="group" aria-label="Редакции правил">
      <ActionMenuItem role="button" v-for="option in controller.options" :key="option.id"
        class="edition-option" :class="{ 'edition-option--current': option.current }"
        :aria-current="option.current ? 'true' : undefined" :disabled="controller.busy"
        @click="select(option)">
        <template #icon><GameContextEmblem :kind="option.emblem" /></template>
        <span class="edition-copy"><strong>{{ option.name }} · {{ option.edition }}</strong><small>{{ option.current ? 'Текущая редакция' : 'Перейти на эту редакцию' }}</small></span>
        <template #suffix><Check v-if="option.current" :size="20" aria-hidden="true" /></template>
      </ActionMenuItem>
    </div>
    <p class="edition-intro">Выбор системы в приложении не меняет редакцию персонажа.</p>
    <p v-if="controller.error" role="alert" class="edition-error">{{ controller.error }}</p>
  </AppModalFrame>
  <ConfirmDialog v-if="pending && controller.open" :title="`Перейти на ${pending.name} · ${pending.edition}?`"
    message="Изменятся правила расчётов и доступные варианты при выборе нового содержимого. Классы, характеристики, способности, заклинания, предметы и выбранные источники сохранятся без автоматического переноса. Проверьте их совместимость с новой редакцией самостоятельно. Перед сменой мы сохраним текущий лист."
    confirm-label="Сменить редакцию" variant="warning" :loading="controller.busy" loading-label="Меняем редакцию…"
    @cancel="pending = null" @confirm="confirm" />
</template>

<script setup>
import { ref } from 'vue'
import { ActionMenuItem, AppModalFrame, ConfirmDialog } from '@sylvieshare/share-ui'
import { Check } from '@lucide/vue'
import GameContextEmblem from '@/shared/ui/GameContextEmblem.vue'
const props = defineProps({ controller: { type: Object, required: true } })
const pending = ref(null)
function select(option) { if (!option.current) pending.value = option }
function close() { if (!props.controller.busy) { pending.value = null; props.controller.open = false } }
async function confirm() { await props.controller.change(pending.value.id); pending.value = null }
</script>

<style scoped>
.edition-intro { color: var(--text-muted); font-size: 13px; line-height: 1.5; margin: 0 0 16px; }
.edition-list { display: grid; gap: 8px; margin-bottom: 16px; }
.edition-option { border: 1px solid var(--border); border-radius: var(--r-md); min-height: 72px; }
.edition-option--current { border-color: var(--accent); background: color-mix(in srgb, var(--accent) 10%, transparent); color: var(--accent); }
.edition-copy { display: flex; flex-direction: column; gap: 5px; text-align: left; }
.edition-copy small { color: var(--text-muted); }
.edition-error { color: var(--danger); font-size: 13px; }
</style>
