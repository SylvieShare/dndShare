import { nextTick, watch } from 'vue'

export function useWorkspaceScrollRegion(header, viewKey) {
  const sources=new Map()
  const key=()=>viewKey?.() ?? 'main'
  watch(key,async()=>{await nextTick();const node=sources.get(key());header.value?.setScrollPosition(node?.isConnected ? node.scrollTop : 0)})
  return event=>{
    const node=event.target
    if(!(node instanceof HTMLElement) || !node.getClientRects().length || node.closest('[inert],[hidden],textarea,input,[contenteditable="true"]')) return
    if(node.scrollHeight<=node.clientHeight && !sources.has(key())) return
    sources.set(key(),node)
    header.value?.setScrollPosition(node.scrollTop)
  }
}
