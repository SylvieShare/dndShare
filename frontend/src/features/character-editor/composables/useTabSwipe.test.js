import { createRenderer, defineComponent, h, nextTick, onMounted, ref } from 'vue'
import { describe, expect, it } from 'vitest'
import { measureMobileTabRects, mobileTabRectsEqual, useTabSwipe } from './useTabSwipe'

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

describe('mobile character tab geometry', () => {
  it('measures buttons relative to the scrolled tabbar', () => {
    const tabbar = {
      scrollLeft: 24,
      getBoundingClientRect: () => ({ left: 10 }),
    }
    const buttons = [
      { getBoundingClientRect: () => ({ left: 18, width: 44 }) },
      { getBoundingClientRect: () => ({ left: 70, width: 56 }) },
    ]

    expect(measureMobileTabRects(tabbar, buttons)).toEqual([
      { x: 32, width: 44 },
      { x: 84, width: 56 },
    ])
  })

  it('keeps holes for tabs whose element is not mounted yet', () => {
    const tabbar = {
      scrollLeft: 0,
      getBoundingClientRect: () => ({ left: 5 }),
    }

    expect(measureMobileTabRects(tabbar, [null])).toEqual([null])
  })

  it('recognizes unchanged geometry so a measurement cannot retrigger rendering', () => {
    expect(mobileTabRectsEqual(
      [{ x: 8, width: 44 }, null, { x: 60, width: 56 }],
      [{ x: 8, width: 44 }, null, { x: 60, width: 56 }],
    )).toBe(true)

    expect(mobileTabRectsEqual(
      [{ x: 8, width: 44 }],
      [{ x: 9, width: 44 }],
    )).toBe(false)
  })

  it('does not turn button function refs into a render and measurement loop', async () => {
    const tabs = ref([{ title: 'Статы' }])
    const mobile = ref(true)
    const tabbar = ref({
      scrollLeft: 0,
      getBoundingClientRect: () => ({ left: 10 }),
    })
    let renderCount = 0
    let swipe

    const app = testRenderer.createApp(defineComponent({
      setup() {
        swipe = useTabSwipe(tabs, mobile, tabbar)
        onMounted(() => swipe.updateMobileTabRects())
        return () => {
          renderCount += 1
          return h('div', [
            h('span', { style: swipe.mobileTabIndicatorStyle.value }),
            h('button', { ref: el => swipe.setMobileTabButtonRef(el, 0) }),
          ])
        }
      },
    }))

    app.mount(hostNode('root'))
    await nextTick()
    await nextTick()
    expect(renderCount).toBe(2)
    app.unmount()
  })

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
