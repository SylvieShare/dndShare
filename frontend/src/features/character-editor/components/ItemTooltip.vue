<template>
  <component :is="interactive ? BasePopover : FloatingTooltip" v-if="interactive || !blocked" v-bind="surfaceProps">
    <div class="itt-content" :class="{ 'itt-content--interactive': interactive }" :style="interactive ? { '--itt-width': (width || 360) + 'px' } : undefined">
        <div class="itt-title" :class="{ 'itt-title--separated': displayDesc || $slots.details }">{{ title }}</div>
        <RichContent v-if="displayDesc" class="itt-desc dnd-rich-content" :html="displayDesc" />
        <template v-if="$slots.details">
          <div v-if="displayDesc" class="itt-sep"></div>
          <div class="itt-details">
            <slot name="details" />
          </div>
        </template>
    </div>
  </component>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { BasePopover, FloatingTooltip, RichContent } from '@sylvieshare/share-ui'
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
  interactive: Boolean,
  zIndex: { type: Number, default: 4000 },
  anchor: { type: Object, default: null },
  title: { type: String, required: true },
  desc: { type: String, default: '' },
  x: { type: Number, default: 0 },
  top: { type: Number, default: null },
  bottom: { type: Number, default: null },
  maxDesc: { type: Number, default: 300 },
  width: { type: Number, default: null },
})
const emit = defineEmits(['close'])
const surfaceProps = computed(() => props.interactive ? {
  open: true, anchor: props.anchor, minWidth: 0, offset: 8, zIndex: props.zIndex,
  transitionPreset: 'action-menu', role: 'dialog', ariaLabel: props.title, popoverClass: 'itt-popup',
  'onUpdate:open': open => { if (!open) emit('close') },
} : { anchor: props.anchor, x: props.x, top: props.top, bottom: props.bottom, width: props.width, zIndex: props.zIndex, tooltipClass: 'itt-box' })

const displayDesc = computed(() => {
  if (!props.desc) return ''
  const plain = props.desc.replace(/<[^>]*>/g, '')
  if (!props.maxDesc || plain.length <= props.maxDesc) return props.desc
  return truncateHtml(props.desc, props.maxDesc)
})
</script>

<style scoped>
.itt-content--interactive {box-sizing:border-box;width:min(var(--itt-width),calc(100vw - 2 * var(--spacing-large) - var(--spacing-small)));max-height:calc(100dvh - 4 * var(--spacing-large));overflow:auto;padding:var(--spacing-small)}
.itt-title {
  overflow-wrap: anywhere;
  color: var(--text-1);
  font-family: var(--font-display);
  font-size: 20px;
  font-weight: 700;
  letter-spacing: 0.01em;
  line-height: 1.15;
}

.itt-title--separated {
  margin-bottom: 9px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--border);
}

.itt-desc {
  color: var(--text-muted);
  font-size: 14px;
  line-height: 1.55;
  margin: 0;
  text-align: left;
}

.itt-sep {
  height: 1px;
  background: var(--border);
  margin: 10px 0 9px;
}

.itt-details {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 5px;
}

</style>
