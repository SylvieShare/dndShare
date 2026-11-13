import { createRenderer, defineComponent, h, nextTick, ref } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useTabSwipe } from './useTabSwipe'

const sortable = vi.hoisted(() => ({ active: false }))
vi.mock('@sylvieshare/share-ui', () => ({ isSortableGestureActive: () => sortable.active }))
afterEach(() => { sortable.active = false; vi.unstubAllGlobals() })

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
  function mountedSwipe() {
    vi.stubGlobal('window', { innerWidth: 704, matchMedia: () => ({ matches: true }) })
    let swipe
    const app = testRenderer.createApp(defineComponent({ setup() {
      swipe = useTabSwipe(ref([{ id: 'stats' }, { id: 'weapons' }]), ref(true))
      return () => h('div')
    } }))
    app.mount(hostNode('root'))
    const event = x => ({ target: { closest: () => null }, changedTouches: [{ clientX: x, clientY: 100 }], preventDefault: vi.fn() })
    return { app, swipe, event }
  }

  it('leaves a reserved sortable pointer alone and accepts the next normal swipe', () => {
    const { app, swipe, event } = mountedSwipe()
    try {
      sortable.active = true
      swipe.onTouchStart(event(300), { clientWidth: 704 })
      swipe.onTouchMove(event(150))
      sortable.active = false // pointerup releases sorting before touchend
      swipe.onTouchEnd(event(150))
      expect(swipe.activeTab.value).toBe(0)
      expect(swipe.tabDragActive.value).toBe(false)
      swipe.onTouchStart(event(300), { clientWidth: 704 })
      swipe.onTouchMove(event(150))
      swipe.onTouchEnd(event(150))
      expect(swipe.activeTab.value).toBe(1)
    } finally { app.unmount() }
  })

  it('discards an already started tab swipe when sorting claims the pointer', () => {
    const { app, swipe, event } = mountedSwipe()
    try {
      swipe.onTouchStart(event(300), { clientWidth: 704 })
      swipe.onTouchMove(event(260))
      expect(swipe.tabDragActive.value).toBe(true)
      sortable.active = true
      swipe.onTouchMove(event(150))
      expect(swipe.tabDragActive.value).toBe(false)
      sortable.active = false
      swipe.onTouchEnd(event(150))
      expect(swipe.activeTab.value).toBe(0)
      expect(swipe.mobileSwipeTrackStyle.value.transform).toBe('translate3d(0%, 0, 0)')
    } finally { app.unmount() }
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
