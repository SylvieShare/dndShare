<template>
  <div class="cc" :class="{ 'cc--embedded': embedded }">
    <CharacterCreationHeader class="cc-head" :icon="icon" :scroll-source="main"
      :show-incomplete="showIncomplete" :incomplete-disabled="incompleteDisabled" :creating="creating"
      @close="$emit('close')" @reset="$emit('reset')" @create-incomplete="$emit('create-incomplete')" />
    <div class="cc-body">
      <CreateStepRail class="cc-rail" :steps="steps" :current="current" :reachable="reachable" @go="$emit('go', $event)" />
      <main ref="main" class="cc-main" :class="mainClass"><slot /></main>
    </div>
    <footer class="cc-foot"><div class="cc-foot-main"><slot name="actions" /></div></footer>
    <slot name="dialogs" />
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import CharacterCreationHeader from '../CharacterCreationHeader.vue'
import CreateStepRail from './CreateStepRail.vue'

defineProps({
  steps: { type: Array, required: true },
  current: Number, reachable: Number, embedded: Boolean, creating: Boolean,
  showIncomplete: Boolean, incompleteDisabled: Boolean,
  mainClass: [String, Object], icon: [Object, Function],
})
const emit = defineEmits(['go', 'close', 'reset', 'create-incomplete', 'scroll-source'])
const main = ref(null)
onMounted(() => emit('scroll-source', main.value))
</script>

<style scoped src="./creationWorkspace.css"></style>
