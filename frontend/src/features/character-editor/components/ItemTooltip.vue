<template>
  <teleport to="body">
    <div
      v-if="!blocked"
      class="itt-box"
      :style="boxStyle"
    >
      <div class="itt-title">{{ title }}</div>
      <RichContent v-if="displayDesc" class="itt-desc dnd-rich-content" :html="displayDesc" />
      <template v-if="$slots.details">
        <div class="itt-sep"></div>
        <div class="itt-details">
          <slot name="details" />
        </div>
      </template>
    </div>
  </teleport>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { RichContent } from '@sylvieshare/share-ui'
import { isTouchActiveOrRecent } from '@/shared/lib/touchGuard'

function truncateHtml(html, max) {
  const tmp = document.createElement('div')
  tmp.innerHTML = html
  let count = 0
  let done = false

  function walk(node) {
    if (done) return
    if (node.nodeType === Node.TEXT_NODE) {
      const remaining = max - count
      if (node.textContent.length > remaining) {
        node.textContent = node.textContent.slice(0, remaining).trimEnd() + '…'
        done = true
      } else {
        count += node.textContent.length
      }
    } else {
      for (const child of [...node.childNodes]) {
        walk(child)
        if (done) {
          while (child.nextSibling) child.parentNode.removeChild(child.nextSibling)
          break
        }
      }
    }
  }

  walk(tmp)
  return tmp.innerHTML
}

const blocked = ref(false)
const isTouchDevice = typeof window !== 'undefined' && window.matchMedia('(hover: none)').matches

function onTouchMove() {
  blocked.value = true
}

onMounted(() => {
  if (isTouchDevice) {
    if (!isTouchActiveOrRecent()) blocked.value = true
    window.addEventListener('touchmove', onTouchMove, { passive: true })
  }
})

onUnmounted(() => {
  if (isTouchDevice) window.removeEventListener('touchmove', onTouchMove)
})

const props = defineProps({
  title: { type: String, required: true },
  desc: { type: String, default: '' },
  x: { type: Number, default: 0 },
  top: { type: Number, default: null },
  bottom: { type: Number, default: null },
  maxDesc: { type: Number, default: 300 },
  width: { type: Number, default: null },
})

const boxStyle = computed(() => {
  const vw = window.innerWidth
  const margin = 8
  const effectiveWidth = props.width ? Math.min(props.width, vw - margin * 2) : Math.min(360, vw - margin * 2)
  const clampedX = Math.max(margin, Math.min(props.x, vw - effectiveWidth - margin))
  return {
    left: clampedX + 'px',
    top: props.top != null ? props.top + 'px' : 'auto',
    bottom: props.bottom != null ? props.bottom + 'px' : 'auto',
    maxWidth: effectiveWidth + 'px',
    ...(props.width ? { width: effectiveWidth + 'px' } : {}),
  }
})
const displayDesc = computed(() => {
  if (!props.desc) return ''
  const plain = props.desc.replace(/<[^>]*>/g, '')
  if (!props.maxDesc || plain.length <= props.maxDesc) return props.desc
  return truncateHtml(props.desc, props.maxDesc)
})
</script>

<style scoped>
.itt-box {
  position: fixed;
  max-width: 360px;
  min-width: 192px;
  background: var(--popover-bg);
  border: 1px solid var(--border-strong);
  border-radius: 10px;
  padding: 10px 14px;
  box-shadow: var(--shadow-lg);
  z-index: 4000;
  pointer-events: none;
}

.itt-title {
  color: var(--text-1);
  font-size: 13px;
  font-weight: bold;
  margin-bottom: 4px;
}

.itt-desc {
  color: var(--text-muted);
  font-size: 12px;
  line-height: 1.3;
  margin: 0;
  text-align: left;
}

.itt-sep {
  height: 1px;
  background: var(--border);
  margin: 8px 0;
}

.itt-details {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 5px;
}
</style>
