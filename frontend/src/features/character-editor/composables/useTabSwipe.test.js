import { createRenderer, defineComponent, h, nextTick, ref } from 'vue'
import { describe, expect, it } from 'vitest'
import { useTabSwipe } from './useTabSwipe'

function hostNode(type, text = '') {
  return {
    type,
    text,
    children: [],
    parent: null,
    props: {},
    getBoundingClientRect: () => ({ left: type === 'button' ? 18 : 10, width: 44 }),
  }
}

function insertHostNode(el, parent, anchor = null) {
  el.parent = parent
  const index = anchor ? parent.children.indexOf(anchor) : -1
  if (index < 0) parent.children.push(el)
  else parent.children.splice(index, 0, el)
}

const testRenderer = createRenderer({
  patchProp(el, key, _previous, value) { el.props[key] = value },
  insert: insertHostNode,
  remove(el) {
    const index = el.parent?.children.indexOf(el) ?? -1
    if (index >= 0) el.parent.children.splice(index, 1)
  },
  createElement: type => hostNode(type),
  createText: text => hostNode('#text', text),
  createComment: text => hostNode('#comment', text),
  setText(node, text) { node.text = text },
  setElementText(el, text) { el.text = text; el.children = [] },
  parentNode: node => node.parent,
  nextSibling(node) {
    const index = node.parent?.children.indexOf(node) ?? -1
    return index >= 0 ? node.parent.children[index + 1] || null : null
  },
  querySelector: () => null,
  setScopeId() {},
  insertStaticContent(content, parent, anchor) {
    const node = hostNode('#static', content)
    insertHostNode(node, parent, anchor)
    return [node, node]
  },
})

describe('character swipe geometry', () => {
  it('positions a restored tab before the mobile pane width is measured', async () => {
    const tabs = ref([
      { title: 'Статы' },
      { title: 'Инвентарь' },
      { title: 'Заклинания' },
    ])
    const mobile = ref(true)
    let swipe

    const app = testRenderer.createApp(defineComponent({
      setup() {
        swipe = useTabSwipe(tabs, mobile)
        swipe.activeTab.value = 2
        return () => h('div', { style: swipe.mobileSwipeTrackStyle.value })
      },
    }))

    app.mount(hostNode('root'))
    await nextTick()

    expect(swipe.mobileSwipeTrackStyle.value.transform).toBe('translate3d(-200%, 0, 0)')
    app.unmount()
  })
})
