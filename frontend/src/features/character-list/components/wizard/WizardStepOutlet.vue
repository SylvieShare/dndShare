<template>
  <div class="wizard-step">
    <slot :name="step.key" :step="step">
      <component :is="step.component" v-if="step.component" />
    </slot>
  </div>
</template>
<script setup>
defineProps({ step: { type: Object, required: true } })
</script>
