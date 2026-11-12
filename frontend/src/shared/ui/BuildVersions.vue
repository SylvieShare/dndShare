<template>
  <button ref="anchor" type="button" class="build-versions" :class="{ 'build-versions--compact': !expanded }" :aria-label="`Версии: фронт ${frontendBuild.version}, бэк ${backendVersion}`" @click="open = !open">
    <template v-if="expanded"><span>Фронт {{ frontendBuild.version }}</span><span>Бэк {{ backendVersion }}<span v-if="!versionState.serverFresh" title="Последняя известная версия"> ·</span></span><span v-if="versionState.native?.android">Приложение {{ versionState.native.android.version }}</span><span v-if="versionState.native?.pending" class="build-update-ready">Обновление готово</span></template>
    <Info v-else :size="16" aria-hidden="true" />
  </button>
  <BasePopover :open="open" :anchor="anchor" placement="bottom-start" transition-preset="action-menu" :min-width="260" role="dialog" aria-label="Версии приложения" @update:open="open = $event">
    <div class="build-version-details" data-build-version-details>
      <strong>Версии приложения</strong>
      <span>Фронтенд {{ frontendBuild.version }} · сборка {{ frontendBuild.build }}</span>
      <span>Бэкенд {{ backendVersion }}<template v-if="versionState.backend"> · сборка {{ versionState.backend.build }}</template></span>
      <span v-if="!versionState.serverFresh">Показана последняя известная версия сервера.</span>
      <span v-if="versionState.native">Android {{ versionState.native.android.version }} · {{ versionState.native.active.bundleId === 'builtin' ? 'интерфейс из APK' : 'обновлённый интерфейс' }}</span>
      <small>Фронт: {{ frontendBuild.commitSha?.slice(0, 8) }}<br />Бэк: {{ versionState.backend?.commitSha?.slice(0, 8) || '—' }}</small>
      <p v-if="versionState.native?.message">{{ versionState.native.message }}</p>
      <p v-if="versionState.error" role="alert">{{ versionState.error }}</p>
      <ActionButton v-if="versionState.native?.pending" variant="secondary" :loading="versionState.applying" @click="applyFrontendUpdate">Перезапустить и обновить</ActionButton>
      <ActionButton variant="quiet" @click="check">Проверить обновления</ActionButton>
    </div>
  </BasePopover>
</template>
<script setup>
import { computed, ref } from 'vue'
import { ActionButton, BasePopover } from '@sylvieshare/share-ui'
import { Info } from '@lucide/vue'
import { frontendBuild } from '@/platform/build'
import { versionState, checkBackendVersion, applyFrontendUpdate, frontendUpdater } from '@/platform/updates'
import { isAndroid } from '@/platform/storage'
defineProps({ expanded: { type: Boolean, default: true } })
const open = ref(false), anchor = ref(null)
const backendVersion = computed(() => versionState.backend?.version || '—')
async function check() {
  versionState.error = ''
  try { await checkBackendVersion(true); if (isAndroid) versionState.native = await frontendUpdater.check() }
  catch (error) { versionState.error = error.message || 'Не удалось проверить обновления.' }
}
</script>
<style scoped>
.build-versions { display:flex;flex-direction:column;align-items:flex-start;gap:2px;width:100%;padding:4px 10px 8px;border:0;background:transparent;color:var(--text-muted);font:inherit;font-size:10px;line-height:1.35;text-align:left;cursor:pointer }
.build-versions:hover { color:var(--text-1) }
.build-versions--compact { align-items:center;padding:8px }
.build-update-ready { color:var(--accent-soft) }
.build-version-details { display:grid;gap:8px;max-width:300px;color:var(--text-2);font-size:12px }
.build-version-details strong { color:var(--text-1) }
.build-version-details small { color:var(--text-muted);font-size:10px }
.build-version-details p { margin:0 }
</style>
