<template>
  <img :src="icons[kind]" width="36" height="36" alt="" draggable="false" />
</template>
<script setup>
defineProps({ kind: String });
const files = import.meta.glob("@/assets/maps/tile-types/*.webp", {
  eager: true,
  import: "default",
});
const icons = Object.fromEntries(
  Object.entries(files).map(([path, url]) => [
    path.split("/").pop().replace(".webp", ""),
    url,
  ]),
);
</script>
<style scoped>
img {
  object-fit: contain;
  pointer-events: none;
}
</style>
