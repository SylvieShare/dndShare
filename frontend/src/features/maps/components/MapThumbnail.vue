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
import { onMounted, ref, watch } from "vue";
import { isWallTile } from "../lib/tileCategories";
import { getMapModels } from "@/shared/api/mapsApi";
const props = defineProps({ document: { type: Object, required: true } }),
  canvas = ref(null);
let models = new Map();
function draw() {
  if (!canvas.value) return;
  const c = canvas.value.getContext("2d"),
    d = props.document,
    s = Math.min(420 / d.width, 280 / d.height),
    ox = (420 - d.width * s) / 2,
    oy = (280 - d.height * s) / 2;
  c.fillStyle = "#161b23";
  c.fillRect(0, 0, 420, 280);
  for (const tile of d.tiles) {
    const model = models.get(tile.modelId);
    c.fillStyle = isWallTile(model) ? "#5b412e" : "#99774f";
    c.fillRect(ox + tile.x * s, oy + tile.y * s, s, s);
    if (isWallTile(model)) {
      c.strokeStyle = "#d0aa7c";
      c.lineWidth = Math.max(1, s * 0.16);
      c.save();
      c.translate(ox + (tile.x + 0.5) * s, oy + (tile.y + 0.5) * s);
      c.rotate((tile.rotation * Math.PI) / 180);
      c.beginPath();
      c.moveTo(-s * 0.4, -s * 0.35);
      c.lineTo(s * 0.4, -s * 0.35);
      c.stroke();
      c.restore();
    }
  }
  for (const o of d.objects) {
    c.fillStyle = ["door", "double-door"].includes(o.kind)
      ? "#d2a571"
      : "#b99f74";
    c.beginPath();
    c.arc(ox + o.x * s, oy + o.y * s, s * 0.3, 0, Math.PI * 2);
    c.fill();
  }
}
onMounted(async () => {
  draw();
  try {
    models = new Map((await getMapModels()).map((m) => [m.id, m]));
    draw();
  } catch {
    /* The full editor reports catalogue errors. */
  }
});
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
