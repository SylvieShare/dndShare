import { nextTick, onBeforeUnmount, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'

export function useAppWorkspaceScroll(header) {
  const route=useRoute()
  const publish=y=>header.value?.setScrollPosition(y)
  const sources=new Set()
  function eligible(node) {
    if (!(node instanceof HTMLElement) || !node.closest('.page-transition-stage') || !node.getClientRects().length
      || node.closest('[inert],[hidden],[aria-hidden="true"],.page-forward-leave-active,.page-backward-leave-active')
      || getComputedStyle(node).visibility==='hidden') return false
    const box=node.getBoundingClientRect()
    return box.right>0 && box.left<innerWidth && box.bottom>0 && box.top<innerHeight
  }
  function windowScroll() {
    let depth=window.scrollY
    for(const node of sources) {
      if(!node.isConnected) sources.delete(node)
      else if(eligible(node)) depth=Math.max(depth,node.scrollTop)
    }
    publish(depth)
  }
  function nestedScroll(event) {
    const node=event.target
    if (!eligible(node) || !node.matches('[data-workspace-scroll]')) return
    sources.add(node)
    windowScroll()
  }
  onMounted(()=>{ window.addEventListener('scroll',windowScroll,{passive:true});document.addEventListener('scroll',nestedScroll,{capture:true,passive:true});windowScroll() })
  watch(()=>route.fullPath,async()=>{await nextTick();windowScroll()})
  onBeforeUnmount(()=>{window.removeEventListener('scroll',windowScroll);document.removeEventListener('scroll',nestedScroll,true)})
}
