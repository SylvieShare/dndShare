<template>
  <section id="account-tutorials-panel" class="account-tutorials" role="tabpanel" aria-labelledby="account-tutorials-tab">
    <h2>Обучение</h2>
    <p>Обучение запускается при первом открытии листа персонажа или сессии. Каждая система, редакция листа, роль в сессии и версия интерфейса запоминаются отдельно в вашем аккаунте.</p>
    <p>Чтобы пройти его прямо сейчас, откройте нужную страницу и выберите в её меню «Пройти обучение снова». Здесь можно включить повторный показ при следующем открытии.</p>
    <LoadingState v-if="loading" label="Загружаем обучение…" />
    <p v-if="error" role="alert">{{ error }} <ActionButton variant="quiet" @click="load">Повторить</ActionButton></p>
    <p v-if="message" role="status">{{ message }}</p>
    <p v-if="!loading && !error && !store.entries.length">Сохранённых результатов пока нет. Обучение появится на соответствующей странице.</p>
    <SectionList v-if="store.entries.length" title="Сохранённые результаты">
      <div v-for="entry in store.entries" :key="tutorialKey(entry)" class="account-tutorials__row">
        <div>
          <strong>{{ TUTORIAL_NAMES[entry.flowId] }}</strong>
          <p>{{ sourceLabel(entry.sourceKey) }} · {{ entry.device === 'mobile' ? 'Телефон' : 'Компьютер' }}</p>
          <small>{{ entry.status === 'completed' ? 'Пройдено' : 'Пропущено' }}</small>
        </div>
        <ActionButton variant="secondary" :disabled="Boolean(saving)" @click="reset(entry)">
          {{ saving === tutorialKey(entry) ? 'Сохраняем…' : 'Показать снова' }}
        </ActionButton>
      </div>
    </SectionList>
  </section>
</template>
<script setup>
import { onMounted, ref } from 'vue'
import { ActionButton, LoadingState, SectionList } from '@sylvieshare/share-ui'
import { useTutorialsStore } from '@/stores/tutorials'
import { useGameContextStore } from '@/stores/gameContext'
import { TUTORIAL_NAMES, tutorialKey } from '../lib/tutorialIdentity'
const store = useTutorialsStore()
const gameContext = useGameContextStore()
const loading = ref(false)
const saving = ref('')
const error = ref('')
const message = ref('')
function sourceLabel(key) {
  if (key === 'unassigned') return 'Сессия без системы'
  const [kind, id] = key.split(':')
  for (const source of gameContext.sources) {
    if (kind === 'source' && String(source.id) === id) return source.name
    const version = (source.versions || []).find(version => String(version.id) === id)
    if (kind === 'edition' && version) return `${source.name} · ${version.version}`
  }
  return 'Источник недоступен'
}
async function load() {
  loading.value = true; error.value = ''
  try { await Promise.all([store.ensure(), gameContext.ensure()]) }
  catch { error.value = 'Не удалось загрузить настройки обучения.' }
  finally { loading.value = false }
}
async function reset(entry) {
  saving.value = tutorialKey(entry); error.value = ''; message.value = ''
  try {
    await store.reset(entry)
    message.value = `${TUTORIAL_NAMES[entry.flowId]}: обучение появится при следующем открытии для ${sourceLabel(entry.sourceKey)} (${entry.device === 'mobile' ? 'телефон' : 'компьютер'}).`
  } catch { error.value = 'Не удалось включить повторное обучение.' }
  finally { saving.value = '' }
}
onMounted(load)
</script>
<style scoped>
.account-tutorials { padding: 24px; color: var(--text-1); }
.account-tutorials > p { max-width: 760px; color: var(--text-2); line-height: 1.5; }
.account-tutorials__row { display: flex; flex-wrap: wrap; gap: 16px; justify-content: space-between; align-items: center; padding: 16px 0; }
.account-tutorials__row p { margin: 4px 0; color: var(--text-2); }
.account-tutorials__row small { color: var(--text-muted); }
</style>
