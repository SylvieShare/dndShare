<template>
  <article ref="frame"><div ref="text">{{ content }}</div></article>
</template>

<script setup>
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

const props = defineProps({ content: { type: String, default: '' } })
const frame = ref(null)
const text = ref(null)
let observer

async function fitText() {
  await nextTick()
  if (!frame.value || !text.value) return
  const styles = getComputedStyle(frame.value)
  const width = frame.value.clientWidth - parseFloat(styles.paddingLeft) - parseFloat(styles.paddingRight)
  const height = frame.value.clientHeight - parseFloat(styles.paddingTop) - parseFloat(styles.paddingBottom)
  let low = 0
  let high = parseFloat(styles.fontSize)
  for (let step = 0; step < 16; step++) {
    const size = (low + high) / 2
    text.value.style.fontSize = `${size}px`
    if (text.value.scrollHeight <= height && text.value.scrollWidth <= width) low = size
    else high = size
  }
  text.value.style.fontSize = `${low}px`
}

watch(() => props.content, fitText)
onMounted(() => {
  observer = new ResizeObserver(fitText)
  observer.observe(frame.value)
  document.fonts?.ready.then(fitText)
})
onBeforeUnmount(() => observer?.disconnect())
</script>

<style scoped>
article { min-width: 0; min-height: 0; overflow: hidden; }
article > div { width: 100%; overflow-wrap: anywhere; }
</style>
