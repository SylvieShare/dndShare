<template>
  <section class="session-world-workspace" :class="variant ? `session-world-workspace--${variant}` : null">
    <slot />
  </section>
</template>

<script setup>
defineProps({ variant: { type: String, default: '' } })
</script>

<style src="./styles/SessionWorldWorkspace.css"></style>
