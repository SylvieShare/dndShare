import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { defaultEvent } from '@/features/character-editor/blocks/dnd/lib/diaryEntry'
import { canConnectJournal, journalEntries, journalLinkId, journalSectionGraph } from '../lib/journalGraph'
import { useJournalLayout } from './useJournalLayout'

export function useJournalGraphEditor(props, emit, canvas) {
  const selectedId = ref('')
  const editingId = ref('')
  const focusEventId = ref('')
  const linkingFrom = ref(null)
  const edgeDraft = ref(null)
  const removingEvent = ref(null)
  const positions = ref({})
  const error = ref('')
  const pointerActive = ref(false)
  const { arranging, arrange } = useJournalLayout()
  const blocked = computed(() => props.busy || arranging.value || Boolean(editingId.value))
  const entries = computed(() => journalEntries(props.journal))
  const selected = computed(() => entries.value.find(event => event.id === selectedId.value))
  const graph = computed(() => journalSectionGraph(props.journal, props.sectionId, positions.value))
  let interactionRevision = null
  const graphBusy = computed(() => pointerActive.value || Boolean(linkingFrom.value) || Boolean(edgeDraft.value) || arranging.value)
  watch(graphBusy, value => emit('dragging', value), { flush: 'sync' })
  watch(editingId, value => emit('editing', value), { flush: 'sync' })
  onBeforeUnmount(() => { emit('dragging', false); emit('editing', '') })

  async function commit(patch) {
    if (blocked.value || !props.editable) return
    error.value = ''
    try { await props.updateGraph({ expectedRevision: props.journal.graph.revision, ...patch }); return true }
    catch (reason) { error.value = reason.message || 'Не удалось сохранить связи'; return false }
  }
  async function select(event, focus = false) {
    if (blocked.value) return
    if (linkingFrom.value) { await connect(linkingFrom.value.id, event.id); return }
    selectedId.value = event.id
    if (event.sectionId !== props.sectionId) emit('section', event.sectionId)
    if (focus) { await nextTick(); await nextTick(); canvas.value?.focusNode(graph.value.nodes.find(node => node.id === event.id)) }
  }
  function startLink(node) {
    if (blocked.value || !props.editable) return
    error.value = ''
    linkingFrom.value = linkingFrom.value?.id === node?.id ? null : node
    interactionRevision = props.journal.graph.revision
  }
  async function connect(fromId, toId) {
    if (!canConnectJournal(props.journal.graph.links, fromId, toId)) {
      error.value = 'Эта связь уже есть или вернёт историю в предыдущую точку.'
      return
    }
    const links = [...props.journal.graph.links, { fromId, toId, label: '' }].map(serializeLink)
    if (await commit({ links, expectedRevision: linkingFrom.value ? interactionRevision : props.journal.graph.revision })) linkingFrom.value = null
  }
  async function unlink(link) {
    await commit({ links: props.journal.graph.links.filter(row => journalLinkId(row) !== journalLinkId(link)).map(serializeLink) })
  }
  function openEdge(edge) {
    if (blocked.value) return
    edgeDraft.value = { ...edge, revision: props.journal.graph.revision }
  }
  async function saveEdge() {
    const edge = edgeDraft.value
    if (await commit({ expectedRevision: edge.revision, links: props.journal.graph.links.map(link => serializeLink(journalLinkId(link) === edge.id ? edge : link)) })) edgeDraft.value = null
  }
  async function removeEdge() {
    const edge = edgeDraft.value
    if (await commit({ expectedRevision: edge.revision, links: props.journal.graph.links.filter(link => journalLinkId(link) !== edge.id).map(serializeLink) })) edgeDraft.value = null
  }
  async function rewire(edge, from, to) {
    const links = props.journal.graph.links.filter(link => journalLinkId(link) !== edge.id)
    if (!canConnectJournal(links, from.id, to.id)) { error.value = 'Нельзя создать повторную связь или цикл.'; return }
    await commit({ expectedRevision: interactionRevision, links: [...links, { fromId: from.id, toId: to.id, label: edge.label }].map(serializeLink) })
  }
  function setInteraction(active) {
    if (active) interactionRevision = props.journal.graph.revision
    pointerActive.value = active
  }
  function preview(rows) { positions.value = Object.fromEntries(rows.map(row => [String(row.id), { positionX: row.x, positionY: row.y }])) }
  async function savePositions(rows) {
    await commit({ expectedRevision: interactionRevision, positions: rows.map(row => ({ id: Number(row.id), positionX: row.x, positionY: row.y })) })
    positions.value = {}
  }
  async function autoLayout() {
    if (blocked.value || !props.editable || !graph.value.nodes.length) return
    const revision = props.journal.graph.revision
    error.value = ''
    try {
      const result = await arrange(graph.value.nodes, graph.value.edges)
      if (result && await commit({ expectedRevision: revision, positions: result })) { await nextTick(); canvas.value?.fitContent() }
    } catch (reason) { error.value = reason.message || 'Не удалось упорядочить холст' }
  }
  async function create(type, root = false) {
    if (blocked.value || !props.editable) return
    const before = new Set(entries.value.map(event => event.id))
    const link = selected.value && !root ? { parentIds: [Number(selectedId.value)] } : root ? { parentIds: [] } : {}
    if (root) {
      const point = canvas.value?.viewportCenter(300, 148)
      if (point) link.graphPosition = { positionX: point.x, positionY: point.y }
    }
    try {
      await props.createEntry(props.sectionId, { ...defaultEvent(), type }, link)
      const event = entries.value.find(event => !before.has(event.id))
      if (event) { await select(event, true); focusEventId.value = event.id }
    } catch (reason) { error.value = reason.message || 'Не удалось создать событие' }
  }
  function setEditing(id, editing) {
    editingId.value = editing ? id : ''
    if (focusEventId.value === id) focusEventId.value = ''
  }
  async function remove() {
    try { await props.removeEntry(removingEvent.value.id); removingEvent.value = null; selectedId.value = '' }
    catch (reason) { error.value = reason.message || 'Не удалось удалить событие' }
  }
  watch(() => props.sectionId, () => { linkingFrom.value = null; positions.value = {}; if (selected.value?.sectionId !== props.sectionId) selectedId.value = '' })
  watch(() => props.journal.graph.revision, () => { positions.value = {} })
  watch(() => props.editable, allowed => { if (!allowed) { linkingFrom.value = null; edgeDraft.value = null; removingEvent.value = null } })
  return { graph, entries, selectedId, selected, editingId, focusEventId, linkingFrom, edgeDraft, removingEvent,
    blocked, arranging, error, select, startLink, connect, unlink, openEdge, saveEdge, removeEdge, rewire,
    setInteraction, preview, savePositions, autoLayout, create, setEditing, remove }
}

function serializeLink(link) { return { fromId: Number(link.fromId), toId: Number(link.toId), label: link.label || '' } }
