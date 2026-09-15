<template>
    <section class="session-settings" data-tutorial="session-settings">
      <header><h1>Настройки сессии</h1><p>Видимость участников для игроков этой сессии.</p></header>
      <BaseTile class="session-settings-section">
        <h2>Игроки</h2>
        <FormField v-for="option in playerOptions" :key="option.key" :label="option.label">
          <ToggleSwitch :model-value="settings[option.key] === true" :disabled="saving" :aria-label="option.label"
            @update:model-value="emit('update-setting', option.key, $event)" />
        </FormField>
        <p>Свой лист и его данные всегда доступны владельцу. Мастер видит всех участников. Чужой лист можно открыть только при включённой публичной ссылке.</p>
        <p v-if="error" class="session-settings-error" role="alert">{{ error }}</p>
        <span v-else-if="saving" role="status">Сохраняем…</span>
      </BaseTile>
      <BaseTile class="session-settings-section">
        <h2>Бой</h2>
        <FormField label="Автоматически бросать HP существ">
          <ToggleSwitch :model-value="settings.autoRollNpcHp" aria-label="Автоматически бросать HP существ"
            @update:model-value="emit('update-setting', 'autoRollNpcHp', $event)" />
        </FormField>
        <p>При добавлении из справочника формула бросается отдельно для каждого существа. Эта настройка сохраняется в текущем браузере.</p>
      </BaseTile>
      <TutorialRestart />
    </section>
</template>
<script setup>
import { BaseTile, FormField, ToggleSwitch } from '@sylvieshare/share-ui'
import TutorialRestart from '@/features/tutorials/components/TutorialRestart.vue'
defineProps({ settings: { type: Object, required: true }, saving: Boolean, error: String })
const emit = defineEmits(['update-setting'])
const playerOptions = [
  { key: 'playersSeeClass', label: 'Игроки видят класс друг друга' },
  { key: 'playersSeeRace', label: 'Игроки видят расу друг друга' },
  { key: 'playersSeeHp', label: 'Игроки видят HP друг друга' },
  { key: 'playersOpenSheets', label: 'Игроки могут открывать листы друг друга' },
]
</script>
<style scoped>
.session-settings { display: flex; flex-direction: column; gap: 20px; max-width: 760px; height: 100%; overflow-y: auto; padding-right: 8px; }
.session-settings h1 { margin: 0; font: 700 28px var(--font-display); }
.session-settings h2 { margin: 0 0 8px; font-size: 18px; }
.session-settings p { margin: 6px 0 0; color: var(--text-muted); font-size: 13px; line-height: 1.6; }
.session-settings-section { display: flex; flex-direction: column; gap: 18px; padding: 22px; }
.session-settings .session-settings-error { color: var(--danger); }
</style>
