<template>
  <main class="account-page">
    <header class="account-hero">
      <div class="account-avatar" aria-hidden="true">{{ initial }}</div>
      <div class="account-identity">
        <span>Аккаунт игрока</span>
        <h1>{{ username }}</h1>
        <p>Настройки безопасности и загруженные вами материалы.</p>
      </div>
    </header>

    <section class="account-surface">
      <SlidingTabs v-model="activeTab" :tabs="tabs" aria-label="Разделы аккаунта">
        <template #icon="{ tab }">
          <component :is="tab.key === 'password' ? LockKeyhole : HardDrive" :size="15" aria-hidden="true" />
        </template>
      </SlidingTabs>

      <section
        v-if="activeTab === 'password'"
        id="account-password-panel"
        class="account-panel account-panel--password"
        role="tabpanel"
        aria-labelledby="account-password-tab"
      >
        <div class="panel-heading">
          <div class="panel-heading__icon"><ShieldCheck :size="22" aria-hidden="true" /></div>
          <div>
            <h2>Изменить пароль</h2>
            <p>После сохранения используйте новый пароль при следующем входе.</p>
          </div>
        </div>

        <form class="password-form" @submit.prevent="changePassword">
          <FormField label="Текущий пароль" vertical>
            <FormTextInput
              v-model:value="password.current"
              type="password"
              autocomplete="current-password"
              :invalid="Boolean(passwordError)"
            />
          </FormField>
          <FormField label="Новый пароль" hint="минимум 4 символа" vertical>
            <FormTextInput
              v-model:value="password.next"
              type="password"
              autocomplete="new-password"
              maxlength="256"
              :invalid="Boolean(passwordError)"
            />
          </FormField>
          <FormField label="Повторите новый пароль" vertical>
            <FormTextInput
              v-model:value="password.confirm"
              type="password"
              autocomplete="new-password"
              maxlength="256"
              :invalid="Boolean(passwordError)"
              @enter="changePassword"
            />
          </FormField>

          <p v-if="passwordError" class="form-message form-message--error" role="alert">{{ passwordError }}</p>
          <p v-else-if="passwordSuccess" class="form-message form-message--success" role="status">
            <CircleCheck :size="15" aria-hidden="true" />
            Пароль изменён
          </p>

          <button class="primary-action" type="submit" :disabled="changingPassword || !canChangePassword">
            <LoaderCircle v-if="changingPassword" class="spin" :size="16" aria-hidden="true" />
            <LockKeyhole v-else :size="16" aria-hidden="true" />
            {{ changingPassword ? 'Сохраняем…' : 'Изменить пароль' }}
          </button>
        </form>
      </section>

      <section
        v-else
        id="account-storage-panel"
        class="account-panel account-panel--storage"
        role="tabpanel"
        aria-labelledby="account-storage-tab"
      >
        <div v-if="storageLoading" class="storage-loading" aria-label="Загрузка статистики">
          <div class="storage-loading__chart" />
          <div class="storage-loading__lines"><i /><i /><i /></div>
        </div>

        <div v-else-if="storageError" class="storage-error" role="alert">
          <CircleAlert :size="28" aria-hidden="true" />
          <strong>Не удалось загрузить статистику</strong>
          <span>{{ storageError }}</span>
          <button type="button" @click="loadStorage">Попробовать снова</button>
        </div>

        <template v-else>
          <div class="storage-overview">
            <SegmentDonutChart
              :segments="chartSegments"
              total-label="занято"
              aria-label="Распределение занятого пространства"
              :format-value="formatBytes"
              :size="230"
            />
            <div class="storage-facts">
              <div>
                <span>Всего файлов</span>
                <strong>{{ storage.fileCount }}</strong>
              </div>
              <div>
                <span>Учтено места</span>
                <strong>{{ formatBytes(storage.usedBytes) }}</strong>
              </div>
              <p v-if="storage.unknownFileCount">
                Для {{ storage.unknownFileCount }} {{ fileWord(storage.unknownFileCount) }} размер пока не удалось определить.
              </p>
            </div>
          </div>

          <section class="upload-section">
            <div class="upload-section__head">
              <div>
                <h2>Ваши загрузки</h2>
                <p>Изображения, видео и музыка, сохранённые в вашем аккаунте.</p>
              </div>
              <span>{{ storage.fileCount }}</span>
            </div>

            <div v-if="!storage.files.length" class="uploads-empty">
              <CloudUpload :size="32" aria-hidden="true" />
              <strong>Загрузок пока нет</strong>
              <span>Загруженные материалы появятся здесь.</span>
            </div>

            <ul v-else class="upload-list">
              <li v-for="file in storage.files" :key="`${file.source}:${file.id}`" class="upload-row">
                <div class="upload-preview" :class="`upload-preview--${file.kind}`">
                  <img v-if="file.kind === 'image' && file.url" :src="file.url" alt="" loading="lazy" />
                  <component v-else :is="kindMeta(file.kind).icon" :size="21" aria-hidden="true" />
                </div>
                <div class="upload-copy">
                  <strong :title="file.name">{{ file.name }}</strong>
                  <span>
                    {{ kindMeta(file.kind).label }}
                    <template v-if="formatStorageDate(file.createdAt)"> · {{ formatStorageDate(file.createdAt) }}</template>
                  </span>
                </div>
                <span class="upload-size" :class="{ 'upload-size--unknown': !hasKnownFileSize(file.fileSize) }">
                  {{ formatBytes(file.fileSize) }}
                </span>
              </li>
            </ul>
          </section>
        </template>
      </section>
    </section>
  </main>
</template>

<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import {
  CircleAlert,
  CircleCheck,
  CloudUpload,
  FileImage,
  Film,
  HardDrive,
  LoaderCircle,
  LockKeyhole,
  Music2,
  ShieldCheck,
} from '@lucide/vue'
import { FormField, FormTextInput, SegmentDonutChart, SlidingTabs } from '@sylvieshare/share-ui'
import { fetchGet, fetchPut } from '@/shared/api/http'
import { useAccountStore } from '@/stores/account'
import { formatBytes, formatStorageDate, hasKnownFileSize } from '@/features/account/lib/storageUsage'

const EMPTY_STORAGE = Object.freeze({
  usedBytes: 0,
  fileCount: 0,
  unknownFileCount: 0,
  breakdown: [],
  files: [],
})
const KIND_META = Object.freeze({
  image: { label: 'Изображение', icon: FileImage, color: 'var(--accent)' },
  video: { label: 'Видео', icon: Film, color: 'var(--info)' },
  music: { label: 'Музыка', icon: Music2, color: 'var(--success)' },
})

const router = useRouter()
const accountStore = useAccountStore()
const activeTab = ref('password')
const storage = ref({ ...EMPTY_STORAGE })
const storageLoading = ref(false)
const storageLoaded = ref(false)
const storageError = ref('')
const changingPassword = ref(false)
const passwordError = ref('')
const passwordSuccess = ref(false)
const password = reactive({ current: '', next: '', confirm: '' })

const tabs = [
  { key: 'password', title: 'Пароль', id: 'account-password-tab', panelId: 'account-password-panel' },
  { key: 'storage', title: 'Использование пространства', id: 'account-storage-tab', panelId: 'account-storage-panel' },
]
const username = computed(() => accountStore.user?.login || 'Игрок')
const initial = computed(() => (username.value[0] || '?').toUpperCase())
const canChangePassword = computed(() => Boolean(password.current && password.next && password.confirm))
const chartSegments = computed(() => (storage.value.breakdown || []).map(item => ({
  key: item.kind,
  label: item.label,
  value: item.bytes,
  color: kindMeta(item.kind).color,
})))

function kindMeta(kind) {
  return KIND_META[kind] || { label: 'Файл', icon: HardDrive, color: 'var(--text-muted)' }
}

function fileWord(count) {
  const mod10 = count % 10
  const mod100 = count % 100
  if (mod10 === 1 && mod100 !== 11) return 'файла'
  return 'файлов'
}

async function changePassword() {
  if (changingPassword.value || !canChangePassword.value) return
  passwordError.value = ''
  passwordSuccess.value = false
  if ([...password.next].length < 4) {
    passwordError.value = 'Новый пароль должен содержать минимум 4 символа'
    return
  }
  if (password.next !== password.confirm) {
    passwordError.value = 'Новые пароли не совпадают'
    return
  }
  changingPassword.value = true
  try {
    await fetchPut('/account/password', {
      currentPassword: password.current,
      newPassword: password.next,
    })
    password.current = ''
    password.next = ''
    password.confirm = ''
    passwordSuccess.value = true
  } catch (error) {
    passwordError.value = error?.message || 'Не удалось изменить пароль'
  } finally {
    changingPassword.value = false
  }
}

async function loadStorage() {
  if (storageLoading.value) return
  storageLoading.value = true
  storageError.value = ''
  try {
    const response = await fetchGet('/account/storage')
    storage.value = {
      usedBytes: Number(response?.usedBytes || 0),
      fileCount: Number(response?.fileCount || 0),
      unknownFileCount: Number(response?.unknownFileCount || 0),
      breakdown: Array.isArray(response?.breakdown) ? response.breakdown : [],
      files: Array.isArray(response?.files) ? response.files : [],
    }
    storageLoaded.value = true
  } catch (error) {
    storageError.value = error?.message || 'Неизвестная ошибка'
  } finally {
    storageLoading.value = false
  }
}

watch(activeTab, tab => {
  if (tab === 'storage' && !storageLoaded.value) loadStorage()
})

onMounted(async () => {
  const user = await accountStore.ensureAuth().catch(() => null)
  if (!user) router.replace('/')
})
</script>

<style scoped src="./styles/ViewAccount.css"></style>
