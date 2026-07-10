// Global `v-click-outside` directive: calls the bound handler when a pointer
// press lands outside the element. Registered once in main.js — replaces the
// per-component copies that used to live in headers, menus and toolbars.
export const clickOutside = {
  beforeMount(el, binding) {
    el._clickOutside = event => {
      if (!el.contains(event.target)) binding.value(event)
    }
    document.addEventListener('mousedown', el._clickOutside)
    document.addEventListener('touchstart', el._clickOutside, { passive: true })
  },
  unmounted(el) {
    document.removeEventListener('mousedown', el._clickOutside)
    document.removeEventListener('touchstart', el._clickOutside)
  },
}
