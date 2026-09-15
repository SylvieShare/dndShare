<template>
    <section class="session-settings" data-tutorial="session-settings">
      <header><h1>Настройки сессии</h1><p>Общие настройки игроков и боя. Сохраняются для всей сессии.</p></header>
      <BaseTile class="session-settings-section">
        <h2>Игроки</h2>
        <FormField v-for="option in playerOptions" :key="option.key" :label="option.label">
          <ToggleSwitch :model-value="settings.players[option.key] === true" :disabled="saving" :aria-label="option.label"
            @update:model-value="emit('update-setting', `players.${option.key}`, $event)" />
        </FormField>
        <p>Свой лист и его данные всегда доступны владельцу. Мастер видит всех участников. Чужой лист можно открыть только при включённой публичной ссылке.</p>
      </BaseTile>
      <BaseTile class="session-settings-section">
        <h2>Бой</h2>
        <FormField label="Автоматически бросать HP существ">
          <ToggleSwitch :model-value="settings.combat.autoRollNpcHp" :disabled="saving" aria-label="Автоматически бросать HP существ"
            @update:model-value="emit('update-setting', 'combat.autoRollNpcHp', $event)" />
        </FormField>
        <p>При добавлении из справочника формула бросается отдельно для каждого существа. Настройка сохраняется для всей сессии.</p>
      </BaseTile>
      <p v-if="error" class="session-settings-error" role="alert">{{ error }}</p>
      <span v-else-if="saving" role="status">Сохраняем…</span>
      <TutorialRestart />
    </section>
</template>
<script setup>
import { BaseTile, FormField, ToggleSwitch } from '@sylvieshare/share-ui'
import TutorialRestart from '@/features/tutorials/components/TutorialRestart.vue'
defineProps({ settings: { type: Object, required: true }, saving: Boolean, error: String })
const emit = defineEmits(['update-setting'])
const playerOptions = [
  { key: 'seeClass', label: 'Игроки видят класс друг друга' },
  { key: 'seeRace', label: 'Игроки видят расу друг друга' },
  { key: 'seeHp', label: 'Игроки видят HP друг друга' },
  { key: 'openSheets', label: 'Игроки могут открывать листы друг друга' },
]
</script>
<style scoped>
.session-settings { display: flex; flex-direction: column; gap: 20px; width: 100%; max-width: 760px; margin-inline: auto; box-sizing: border-box; height: 100%; overflow-y: auto; padding-right: 8px; }
.session-settings h1 { margin: 0; font: 700 28px var(--font-display); }
.session-settings h2 { margin: 0 0 8px; font-size: 18px; }
.session-settings p { margin: 6px 0 0; color: var(--text-muted); font-size: 13px; line-height: 1.6; }
.session-settings-section { display: flex; flex-direction: column; gap: 18px; padding: 22px; }
.session-settings .session-settings-error { color: var(--danger); }
</style>
