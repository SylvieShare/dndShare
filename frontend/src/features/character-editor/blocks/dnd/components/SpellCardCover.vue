<template>
  <div class="spell-card-cover" aria-hidden="true">
    <SkeletonBlock v-if="source && !loaded" width="78%" height="100%" class="spell-card-cover-skeleton" />
    <img v-if="source" :key="source" :src="source" class="spell-card-cover-image" :class="{ 'spell-card-cover-image--ready': loaded }"
      alt="" loading="lazy" decoding="async" @load="onLoad" @error="onError" />
  </div>
</template>
<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { SkeletonBlock } from '@sylvieshare/share-ui'
import { useItemTypesStore } from '@/stores/itemTypes'
const props = defineProps({ item: Object })
const types = useItemTypesStore(), failed = ref([]), loaded = ref(false)
const defaultCover = computed(() => types.getType(Number(props.item?.typeId) || 5)?.coverImageUrl || '')
const source = computed(() => [props.item?.coverImageUrl, defaultCover.value].find(url => url && !failed.value.includes(url)) || '')
watch([() => props.item?.id, () => props.item?.coverImageUrl, defaultCover], () => { failed.value = [] })
watch(source, () => { loaded.value = false })
onMounted(() => { types.ensureAll().catch(() => {}) })
function onLoad(event) { if (event.currentTarget.getAttribute('src') === source.value) loaded.value = true }
function onError(event) { failed.value = [...failed.value, event.currentTarget.getAttribute('src')] }
</script>
<style scoped>
.spell-card-cover {position:absolute;inset:0;overflow:hidden;pointer-events:none;z-index:0}
.spell-card-cover-image,.spell-card-cover-skeleton {position:absolute;inset:0 0 0 auto;width:78%;height:100%;mask-image:linear-gradient(90deg,transparent 0%,var(--text-1) 66%)}
.spell-card-cover-image {object-fit:cover;object-position:65% center;opacity:0;transition:opacity var(--motion-enter) ease}
.spell-card-cover-image--ready {opacity:.56}
.spell-card-cover-skeleton {opacity:.15}
.spell-card-cover::after {content:'';position:absolute;inset:0;background:linear-gradient(180deg,transparent 10%,color-mix(in srgb,var(--surface) 25%,transparent) 60%,color-mix(in srgb,var(--surface) 85%,transparent))}
@media(prefers-reduced-motion:reduce){.spell-card-cover-image{transition:none}}
</style>
