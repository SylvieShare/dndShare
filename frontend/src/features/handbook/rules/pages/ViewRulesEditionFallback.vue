<template>
  <ViewRulesUnavailable :system-name="systemName" :version="versionName" />
</template>

<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import ViewRulesUnavailable from '@/features/handbook/rules/pages/ViewRulesUnavailable.vue'

const route = useRoute()
const systemName = computed(() => String(route.params.systemSlug).replaceAll('-', ' '))
const versionName = computed(() => String(route.params.versionSlug).replaceAll('-', ' '))
</script>
