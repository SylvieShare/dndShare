<template>
  <div class="map-thumbnail">
    <img
      v-if="document.kind !== 'tiles'"
      :src="document.background.url"
      alt=""
      loading="lazy"
    /><canvas v-else ref="canvas" width="420" height="280" aria-hidden="true" />
  </div>
</template>
<script setup>
import { onMounted, ref, watch } from 'vue';
import { TERRAINS, terrainAt } from '../lib/mapModel';
const props = defineProps({ document: { type: Object, required: true } }),
  canvas = ref(null);
function draw() {
  if (!canvas.value) return;
  const c = canvas.value.getContext('2d'),
    d = props.document,
    s = Math.min(420 / d.width, 280 / d.height),
    ox = (420 - d.width * s) / 2,
    oy = (280 - d.height * s) / 2;
  c.fillStyle = '#161b23';
  c.fillRect(0, 0, 420, 280);
  const colors = Object.fromEntries(TERRAINS.map((t) => [t.id, t.color]));
  for (let y = 0; y < d.height; y++)
    for (let x = 0; x < d.width; x++) {
      const kind = terrainAt(d, x, y);
      c.fillStyle = colors[kind];
      c.fillRect(ox + x * s, oy + y * s, s + 0.3, s + 0.3);
      if (kind.startsWith('wall-')) {
        c.fillStyle = '#ffffff18';
        c.fillRect(ox + x * s, oy + y * s, s, 1);
      }
    }
  for (const o of d.objects) {
    c.fillStyle = ['door', 'double-door'].includes(o.kind) ? '#d2a571' : '#b99f74';
    c.beginPath();
    c.arc(ox + o.x * s, oy + o.y * s, s * 0.3, 0, Math.PI * 2);
    c.fill();
  }
}
onMounted(draw);
watch(() => props.document, draw, { deep: true });
</script>
<style scoped>
.map-thumbnail {
  height: 180px;
  background: var(--bg);
  border-radius: 9px;
  overflow: hidden;
}
.map-thumbnail img,
.map-thumbnail canvas {
  width: 100%;
  height: 100%;
  display: block;
  object-fit: contain;
}
</style>
