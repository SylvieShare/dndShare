<template>
  <main class="master-tools">
    <header class="tools-header"><span class="tools-eyebrow">Для мастера</span><h1>Инструменты</h1><p>Находки и встречи для следующего приключения.</p></header>
    <LoadingState v-if="!ready" label="Открываем инструменты…" />
    <p v-else-if="error" role="alert">{{ error }}</p>
    <p v-else-if="!authenticated">Войдите в аккаунт, чтобы пользоваться инструментами мастера.</p>
    <template v-else>
      <SlidingTabs v-model="tab" :tabs="tabs" aria-label="Инструменты мастера" />
      <section v-show="tab === 'treasure'" id="tools-treasure" role="tabpanel" aria-labelledby="tab-treasure">
        <TreasureGenerator v-if="isDnd" />
        <BaseTile v-else class="tools-settings"><h2>Сокровища D&D 5e · 2014</h2><p>Для этого генератора выберите D&D 5e, редакцию 2014, в меню игровой системы. Сцены ночлега и странствий доступны для любой системы.</p></BaseTile>
      </section>
      <section v-show="tab === 'camp'" id="tools-camp" role="tabpanel" aria-labelledby="tab-camp"><JourneyGenerator mode="camp" /></section>
      <section v-show="tab === 'travel'" id="tools-travel" role="tabpanel" aria-labelledby="tab-travel"><JourneyGenerator mode="travel" /></section>
    </template>
  </main>
</template>
<script setup>
import { computed, onMounted, ref } from 'vue'
import { BaseTile, LoadingState, SlidingTabs } from '@sylvieshare/share-ui'
import { useAccountStore } from '@/stores/account'
import { useGameContextStore } from '@/stores/gameContext'
import { isDnd5e2014 } from '@/shared/lib/gameSystems'
import TreasureGenerator from '../components/TreasureGenerator.vue'
import JourneyGenerator from '../components/JourneyGenerator.vue'
const account = useAccountStore(), game = useGameContextStore()
const tab = ref('treasure'), ready = ref(false), error = ref('')
const authenticated = computed(() => account.authStatus === 'success')
const isDnd = computed(() => isDnd5e2014(game.context))
const tabs = [{ key: 'treasure', title: 'Сокровища' }, { key: 'camp', title: 'Ночлег' }, { key: 'travel', title: 'Странствие' }].map(t => ({ ...t, id: `tab-${t.key}`, panelId: `tools-${t.key}` }))
onMounted(async () => { try { await Promise.all([account.ensureAuth(), game.ensure()]) } catch { error.value = 'Не удалось открыть инструменты. Обновите страницу.' } finally { ready.value = true } })
</script>
<style src="../styles/masterTools.css"></style>
