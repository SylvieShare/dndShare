<template>
  <div class="input-desc">
    <div v-if="block.title || showToggle" class="desc-head">
      <span v-if="block.title" class="desc-title">{{ block.title }}</span>
      <button v-if="showToggle && !editOn" class="field-edit-btn" type="button" title="Редактировать" @click="editOn = true">
        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
        </svg>
      </button>
      <button v-else-if="showToggle" class="desc-done-btn" type="button" @click="editOn = false">Готово</button>
    </div>

    <template v-if="editing">
      <div class="desc-toolbar" ref="toolbar">

        <button type="button" class="desc-btn" title="Жирный"      @mousedown.prevent="fmt('bold')"><b>Ж</b></button>
        <button type="button" class="desc-btn" title="Курсив"       @mousedown.prevent="fmt('italic')"><i>К</i></button>
        <button type="button" class="desc-btn" title="Подчёркнутый" @mousedown.prevent="fmt('underline')"><u>П</u></button>

        <div class="desc-sep" />

        <!-- Heading picker -->
        <div class="desc-drop-wrap" ref="hWrap">
          <button type="button" class="desc-btn desc-btn-wide" @mousedown.prevent="hOpen = !hOpen">
            Абзац <span class="desc-caret">▾</span>
          </button>
          <div v-if="hOpen" class="desc-drop">
            <button type="button" class="desc-drop-item drop-p"  @mousedown.prevent="applyBlock('p')">Обычный текст</button>
            <button type="button" class="desc-drop-item drop-h1" @mousedown.prevent="applyBlock('h1')">Заголовок 1</button>
            <button type="button" class="desc-drop-item drop-h2" @mousedown.prevent="applyBlock('h2')">Заголовок 2</button>
            <button type="button" class="desc-drop-item drop-h3" @mousedown.prevent="applyBlock('h3')">Заголовок 3</button>
            <button type="button" class="desc-drop-item drop-h4" @mousedown.prevent="applyBlock('h4')">Заголовок 4</button>
            <button type="button" class="desc-drop-item drop-h5" @mousedown.prevent="applyBlock('h5')">Заголовок 5</button>
            <button type="button" class="desc-drop-item drop-h6" @mousedown.prevent="applyBlock('h6')">Заголовок 6</button>
          </div>
        </div>

        <div class="desc-sep" />

        <!-- Color picker -->
        <ColorPresetPicker allow-clear :model-value="''" @update:model-value="applyColor">
          <template #trigger="{ toggle }">
            <button type="button" class="desc-btn" title="Цвет текста" @mousedown.prevent="hOpen = false; toggle()">
              <span class="desc-color-icon">А</span>
            </button>
          </template>
        </ColorPresetPicker>

      </div>

      <div
        ref="editor"
        class="desc-editor"
        contenteditable="true"
        spellcheck="false"
        translate="no"
        autocorrect="off"
        :data-placeholder="block.content?.placeholder ?? 'Текст...'"
        @input="onInput"
        @keydown="onKeydown"
      />
    </template>

    <RichContent
      v-else-if="value"
      class="desc-view"
      :class="{ 'desc-view--owner': showToggle }"
      :html="value"
      @click="showToggle && (editOn = true)"
    />
    <div
      v-else
      class="desc-empty"
      :class="{ 'desc-empty--owner': showToggle }"
      @click="showToggle && (editOn = true)"
    >{{ block.content?.placeholder ?? '' }}</div>
  </div>
</template>

<script setup>
import { computed, inject, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import ColorPresetPicker from '@/shared/ui/ColorPresetPicker'
import RichContent from '@/shared/ui/RichContent'

const props = defineProps({
  block: { type: Object, default: () => ({}) },
  value: { type: String, default: '' },
  editable: { type: Boolean, default: false },
})
const emit = defineEmits(['update:value'])
const charCtx = inject('charCtx', { ownerMode: true, dictionaries: {}, var: {} })

// `editable` forces the editor on regardless of ownership (e.g. inside a morph editor).
// Otherwise the owner reads by default and flips into edit via the pencil (editOn).
const owner = computed(() => !!charCtx.ownerMode)
const showToggle = computed(() => owner.value && !props.editable)
const editOn = ref(false)
const editing = computed(() => props.editable || (owner.value && editOn.value))

const hOpen = ref(false)
const editor = ref(null)
const hWrap = ref(null)
let _onDown = null

watch(editing, (val) => {
  if (val) nextTick(() => { if (editor.value) editor.value.innerHTML = props.value || '<p><br></p>' })
})

onMounted(() => {
  if (editing.value && editor.value) {
    editor.value.innerHTML = props.value || '<p><br></p>'
    document.execCommand('defaultParagraphSeparator', false, 'p')
  }
  _onDown = (e) => {
    if (!hWrap.value?.contains(e.target)) hOpen.value = false
  }
  document.addEventListener('mousedown', _onDown)
})

onBeforeUnmount(() => {
  document.removeEventListener('mousedown', _onDown)
})

function fmt(cmd) {
  editor.value?.focus()
  document.execCommand('styleWithCSS', false, false)
  document.execCommand(cmd, false, null)
  nextTick(() => commitEditor())
}

function applyBlock(tag) {
  editor.value?.focus()
  document.execCommand('formatBlock', false, tag)
  hOpen.value = false
  nextTick(() => {
    commitEditor()
  })
}

function applyColor(color) {
  editor.value?.focus()
  document.execCommand('styleWithCSS', false, true)
  if (color) {
    document.execCommand('foreColor', false, color)
    commitEditor()
  } else {
    document.execCommand('removeFormat', false, null)
    nextTick(() => {
      if (!editor.value) return
      editor.value.querySelectorAll('span').forEach(span => {
        span.style.removeProperty('font-family')
        if (!span.style.cssText.trim()) span.replaceWith(...[...span.childNodes])
      })
      commitEditor()
    })
  }
}

function onInput() {
  if (!editor.value) return
  autoCreateList()
  for (const child of [...editor.value.children]) {
    if (child.tagName === 'DIV') {
      const p = document.createElement('p')
      p.innerHTML = child.innerHTML
      child.replaceWith(p)
    }
  }
  commitEditor()
}

function commitEditor() {
  if (!editor.value) return
  normalizeInlineTags(editor.value)
  emit('update:value', props.block.id, editor.value.innerHTML)
}

function normalizeInlineTags(root) {
  root.querySelectorAll('strong').forEach(el => renameElement(el, 'b'))
  root.querySelectorAll('i').forEach(el => renameElement(el, 'em'))
  root.querySelectorAll('span').forEach(span => {
    const weight = span.style.fontWeight
    const style = span.style.fontStyle
    const decoration = span.style.textDecorationLine || span.style.textDecoration
    let replacement = null
    if (weight === 'bold' || Number(weight) >= 600) {
      span.style.removeProperty('font-weight')
      replacement = 'b'
    } else if (style === 'italic') {
      span.style.removeProperty('font-style')
      replacement = 'em'
    } else if (String(decoration).includes('underline')) {
      span.style.removeProperty('text-decoration')
      span.style.removeProperty('text-decoration-line')
      replacement = 'u'
    }
    if (replacement) renameElement(span, replacement)
  })
}

function renameElement(el, tag) {
  const next = document.createElement(tag)
  for (const attr of [...el.attributes]) {
    if (attr.name !== 'style' || el.style.cssText.trim()) next.setAttribute(attr.name, attr.value)
  }
  next.append(...[...el.childNodes])
  el.replaceWith(next)
  return next
}

function autoCreateList() {
  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0 || !editor.value?.contains(sel.anchorNode)) return

  const block = currentTextBlock(sel.anchorNode)
  if (!block || block.tagName === 'LI') return

  const text = block.textContent || ''
  if (text !== '- ' && text !== ' - ') return

  const li = document.createElement('li')
  li.innerHTML = '<br>'
  const ul = document.createElement('ul')
  ul.appendChild(li)
  block.replaceWith(ul)
  placeCaretAtStart(li)
}

function currentTextBlock(node) {
  let current = node.nodeType === Node.TEXT_NODE ? node.parentNode : node
  while (current && current !== editor.value) {
    if (['P', 'DIV', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6'].includes(current.tagName)) return current
    current = current.parentNode
  }
  return null
}

function placeCaretAtStart(el) {
  const range = document.createRange()
  const sel = window.getSelection()
  range.selectNodeContents(el)
  range.collapse(true)
  sel.removeAllRanges()
  sel.addRange(range)
}

function onKeydown(e) {
  if (e.key === ' ') {
    if (tryCreateListFromDash()) {
      e.preventDefault()
      commitEditor()
    }
    return
  }

  if (e.key !== 'Enter') return
  e.preventDefault()
  if (e.shiftKey) {
    document.execCommand('insertLineBreak')
  } else {
    document.execCommand('insertParagraph')
  }
  commitEditor()
}

function tryCreateListFromDash() {
  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0 || !editor.value?.contains(sel.anchorNode)) return false

  const block = currentTextBlock(sel.anchorNode)
  if (!block || block.tagName === 'LI') return false

  const text = (block.textContent || '').replace(/\u00a0/g, ' ')
  if (text !== '-' && text !== ' -') return false

  const li = document.createElement('li')
  li.innerHTML = '<br>'
  const ul = document.createElement('ul')
  ul.appendChild(li)
  block.replaceWith(ul)
  placeCaretAtStart(li)
  return true
}
</script>

<style scoped>
.input-desc {
  display: flex;
  flex-direction: column;
}

/* ── Title + owner edit toggle ── */
.desc-head {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 24px;
  margin-bottom: 4px;
}

.desc-title {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--text-2);
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}


.desc-head .field-edit-btn,
.desc-head .desc-done-btn {
  margin-left: auto;
}

.field-edit-btn {
  width: 24px;
  height: 24px;
  display: grid;
  place-items: center;
  border: none;
  border-radius: 6px;
  background: none;
  color: var(--text-muted);
  cursor: pointer;
  opacity: 0.35;
  transition: color 0.15s, opacity 0.15s;
}
@media (hover: hover) {
  .input-desc:hover .field-edit-btn { color: var(--accent); opacity: 1; }
}
.field-edit-btn:focus-visible { color: var(--accent); opacity: 1; }

.desc-done-btn {
  background: none;
  border: none;
  color: var(--accent);
  font: inherit;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  padding: 3px 8px;
  border-radius: 6px;
  transition: background 0.12s;
}
.desc-done-btn:hover { background: color-mix(in srgb, var(--text-on-accent) 6%, transparent); }

.desc-view--owner,
.desc-empty--owner { cursor: text; }

/* ── Toolbar ── */
.desc-toolbar {
  display: flex;
  align-items: center;
  gap: 2px;
  margin-bottom: 2px;
  flex-wrap: wrap;
}

.desc-btn {
  background: none;
  border: none;
  color: var(--text-muted);
  font-family: inherit;
  font-size: 13px;
  height: 26px;
  min-width: 26px;
  padding: 0 5px;
  border-radius: var(--r-sm);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 3px;
  transition: background 0.12s, color 0.12s;
  flex-shrink: 0;
}

.desc-btn:hover { background: var(--surface-raised); color: var(--text-2); }

.desc-btn-wide {
  font-size: 12px;
  padding: 0 7px;
  gap: 4px;
}

.desc-caret {
  font-size: 9px;
  opacity: 0.6;
}

.desc-sep {
  width: 1px;
  height: 16px;
  background: var(--border);
  margin: 0 3px;
  flex-shrink: 0;
}

/* Color icon: letter А with rainbow underline */
.desc-color-icon {
  display: flex;
  flex-direction: column;
  align-items: center;
  line-height: 1;
  gap: 2px;
  font-weight: 700;
  font-size: 13px;
}

.desc-color-icon::after {
  content: '';
  width: 14px;
  height: 3px;
  border-radius: 2px;
  background: linear-gradient(90deg, var(--danger), var(--warning), var(--success), var(--accent-soft), var(--info));
}

/* ── Dropdowns ── */
.desc-drop-wrap {
  position: relative;
}

.desc-drop {
  position: absolute;
  top: calc(100% + 5px);
  left: 0;
  z-index: 150;
  background: var(--popover-bg);
  border: 1px solid var(--border-strong);
  border-radius: var(--r-md);
  padding: 5px;
  min-width: 160px;
  box-shadow: var(--shadow-lg);
}

.desc-drop-item {
  display: block;
  width: 100%;
  background: none;
  border: none;
  text-align: left;
  padding: 6px 10px;
  border-radius: var(--r-sm);
  cursor: pointer;
  color: var(--text-2);
  font-family: inherit;
  transition: background 0.12s, color 0.12s;
}

.desc-drop-item:hover { background: var(--border); color: var(--text-1); }

.drop-p  { font-size: 13px; }
.drop-h1 { font-size: 20px; font-weight: 700; color: var(--text-1); }
.drop-h2 { font-size: 17px; font-weight: 700; color: var(--text-1); }
.drop-h3 { font-size: 15px; font-weight: 600; color: var(--text-2); }
.drop-h4 { font-size: 13px; font-weight: 600; color: var(--text-2); }
.drop-h5 { font-size: 12px; font-weight: 600; color: var(--text-2); }
.drop-h6 { font-size: 11px; font-weight: 600; color: var(--text-muted); }

/* ── Editor ── */
.desc-editor {
  -webkit-touch-callout: none;
  min-width: 0;
  overflow-wrap: anywhere;
  padding: 10px 12px;
  color: var(--text-2);
  font-size: 14px;
  font-family: inherit;
  line-height: 1.42;
  min-height: 80px;
  outline: none;
  border: none;
  border-radius: var(--r-md);
  background: var(--surface-raised);
  transition: box-shadow 0.12s;
}

.desc-editor:focus { box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent) 35%, transparent); }

.desc-editor:empty::before {
  content: attr(data-placeholder);
  color: var(--text-muted);
  pointer-events: none;
}

.desc-editor :deep(h1) { font-size: 22px; font-weight: 700; color: var(--text-1); margin: 0 0 8px; line-height: 1.3; }
.desc-editor :deep(h2) { font-size: 18px; font-weight: 700; color: var(--text-1);    margin: 0 0 8px; line-height: 1.3; }
.desc-editor :deep(h3) { font-size: 16px; font-weight: 600; color: var(--text-2);    margin: 0 0 6px; line-height: 1.3; }
.desc-editor :deep(h4) { font-size: 14px; font-weight: 600; color: var(--text-2);    margin: 0 0 6px; }
.desc-editor :deep(h5) { font-size: 13px; font-weight: 600; color: var(--text-2);    margin: 0 0 4px; }
.desc-editor :deep(h6) { font-size: 12px; font-weight: 600; color: var(--text-muted);    margin: 0 0 4px; }
.desc-editor :deep(ul),
.desc-editor :deep(ol) { margin: 6px 0 8px 20px; padding: 0; }
.desc-editor :deep(li) { margin: 3px 0; }

/* ── View ── */
.desc-view {
  font-size: 14px;
  color: var(--text-2);
  line-height: 1.42;
  padding: 2px 0;
  min-width: 0;
  overflow-wrap: anywhere;
}

.desc-empty {
  font-size: 13px;
  color: var(--text-muted);
}
</style>
