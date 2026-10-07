<template>
  <img
    :src="icons[kind]"
    :width="size"
    :height="size"
    alt=""
    draggable="false"
  />
</template>
<script setup>
defineProps({ kind: String, size: { type: Number, default: 36 } });
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
