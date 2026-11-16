import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { Archive, Plus } from '@lucide/vue'
import { DEFAULT_RESERVE_ID } from '../lib/encounterReserves'

export function useEncounterReserveSidebar(encounter, sidebar) {
  const editing = ref(false), draftName = ref(''), pendingDelete = ref(null)
  const active = computed(() => encounter.reserveTabs.find(tab => tab.id === encounter.activeReserveId) || encounter.reserveTabs[0])
  const selected = computed(() => sidebar.selected.value.startsWith('reserves:'))
  const unregister = sidebarContextRegister()
  function sidebarContextRegister() {
    return sidebar.register('reserves', {
      tabs: () => [
        ...encounter.reserveTabs.map((tab,index) => ({key:tab.id,label:tab.name,icon:Archive,divider:index===0,dividerLabel:index===0?'Запасы существ':undefined})),
        {key:'add',label:'Добавить вкладку',shortLabel:'Добавить',icon:Plus,action:true,disabled:!encounter.canManageReserves,
          attrs:{style:{borderStyle:'dashed',borderColor:'var(--border-strong)'}}},
      ],
      resize() {},
      action: async key => {
        if (key !== 'add') return
        const id = encounter.createReserve()
        if (!id) return
        sidebar.select('reserves',id)
        await nextTick()
        startRename()
      },
    })
  }
  watch(sidebar.selected, key => {
    editing.value = false
    if (key.startsWith('reserves:')) encounter.selectReserve(key.slice('reserves:'.length))
  }, {flush:'sync'})
  function startRename() {
    if (active.value.permanent || !encounter.canManageReserves) return
    draftName.value = active.value.name
    editing.value = true
  }
  function saveName() {
    if (!editing.value) return
    editing.value = false
    if (draftName.value.trim()) encounter.renameReserve(active.value.id,draftName.value)
  }
  function cancelName() { editing.value = false }
  function requestDelete() { if (!active.value.permanent && encounter.canManageReserves) pendingDelete.value = active.value }
  function confirmDelete() {
    if (!pendingDelete.value) return
    encounter.removeReserve(pendingDelete.value.id)
    pendingDelete.value = null
    sidebar.select('reserves',DEFAULT_RESERVE_ID)
  }
  onBeforeUnmount(unregister)
  return {active,selected,editing,draftName,pendingDelete,startRename,saveName,cancelName,requestDelete,confirmDelete}
}
