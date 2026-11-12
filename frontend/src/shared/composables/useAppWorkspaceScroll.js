import { nextTick, onBeforeUnmount, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'

export function useAppWorkspaceScroll(header) {
  const route=useRoute()
  const publish=y=>header.value?.setScrollPosition(y)
  const windowScroll=()=>publish(window.scrollY)
  function nestedScroll(event) {
    const node=event.target
    if (!(node instanceof HTMLElement) || !node.matches('[data-workspace-scroll]')
      || node.closest('[inert], [hidden], .page-forward-leave-active, .page-backward-leave-active')) return
    publish(node.scrollTop)
  }
  onMounted(()=>{ window.addEventListener('scroll',windowScroll,{passive:true});document.addEventListener('scroll',nestedScroll,{capture:true,passive:true});windowScroll() })
  watch(()=>route.fullPath,async()=>{await nextTick();windowScroll()})
  onBeforeUnmount(()=>{window.removeEventListener('scroll',windowScroll);document.removeEventListener('scroll',nestedScroll,true)})
}
