<template>
  <div ref="c" class="head-value editable"
       :contenteditable="readonly ? 'false' : 'true'"
       spellcheck="false"
       @input="onInput"
       @focus="onFocus"
       @blur="onChange"
       @keydown.enter="onEnter()"
  ></div>
</template>

<script setup>
import { ref, watch, onMounted } from 'vue'

const props = defineProps(['v', 'checkerV', 'defaultV', 'readonly'])
const emit = defineEmits(['update:v', 'change:v', 'focus:v', 'blur:v'])

const c = ref(null)
let last = null
let sv = null

onMounted(() => {
  c.value.innerText = props.v ?? ''
})

watch(() => props.v, (newVal) => {
  if (sv === null) {
    c.value.innerText = newVal ?? ''
  }
})

function onInput(el) {
  if (props.readonly) return
  let target = el.target
  let v = target.innerText.replace(/[\n\r]/g, '')
  if (!props.checkerV || props.checkerV.test(v)) {
    last = v
    emit('update:v', v)
  } else {
    const sel = window.getSelection()
    const offset = sel.focusOffset - 1
    target.innerText = last
    restoreCaret(target, Math.max(0, offset))
  }
}

function onFocus(el) {
  if (props.readonly) return
  last = el.target.innerText.replace(/[\n\r]/g, '')
  sv = last
  emit('focus:v')
}

function onChange(el) {
  if (props.readonly) return
  let lastVal = el.target.innerText.replace(/[\n\r]/g, '')
  if (lastVal.trim() === '' && props.defaultV !== undefined) {
    lastVal = String(props.defaultV)
    el.target.innerText = lastVal
  }
  if (lastVal !== sv) {
    emit('change:v', lastVal)
  }
  sv = null
  last = null
  emit('blur:v')
}

function onEnter() {
  c.value.blur()
}

function restoreCaret(el, offset) {
  const range = document.createRange()
  const sel = window.getSelection()
  const node = el.firstChild
  if (node) {
    range.setStart(node, Math.min(offset, node.length))
    range.collapse(true)
    sel.removeAllRanges()
    sel.addRange(range)
  }
}
</script>
