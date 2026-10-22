<template>
  <section class="map-decal-palette" aria-label="Каталог декалей">
    <ActionButton
      variant="secondary"
      :disabled="uploading"
      @click="fileInput?.click()"
    >
      <template #icon><Upload :size="16" /></template
      >{{ uploading ? "Загрузка…" : "Загрузить свою" }}
    </ActionButton>
    <input
      ref="fileInput"
      type="file"
      accept="image/png,image/jpeg,image/webp"
      hidden
      @change="upload"
    />
    <p class="map-hint">
      Перетащите декаль на поверхность модели. R — поворот, Esc — отмена. PNG,
      JPG или WebP до 8 МБ.
    </p>
    <p v-if="error" role="alert" class="map-error">{{ error }}</p>
    <MapModelCatalogue
      :groups="groups"
      compact
      draggable
      @drag-tile="(id, event) => emit('drag', entry(id), event)"
      @model="(id, event) => emit('place', entry(id), event)"
    />
    <p v-if="!images.length" class="map-hint">
      Загруженные изображения появятся в группе «Свои».
    </p>
  </section>
</template>
<script setup>
import { computed, onMounted, ref } from "vue";
import { ActionButton } from "@sylvieshare/share-ui";
import { Upload } from "@lucide/vue";
import { decalCatalogueGroups } from "../lib/mapDecals";
import { getMapDecals, uploadMapDecal } from "@/shared/api/mapDecalsApi";
import MapModelCatalogue from "./MapModelCatalogue.vue";
const emit = defineEmits(["place", "drag"]);
const images = ref([]),
  error = ref(""),
  uploading = ref(false),
  fileInput = ref(null);
const groups = computed(() => decalCatalogueGroups(images.value));
const entries = computed(
  () =>
    new Map(
      groups.value
        .flatMap((group) => group.subsections[0].models)
        .map((image) => [image.id, image]),
    ),
);
const entry = (id) => entries.value.get(id);
onMounted(async () => {
  try {
    images.value = await getMapDecals();
  } catch (cause) {
    error.value = cause.message;
  }
});
async function upload(event) {
  const file = event.target.files?.[0];
  event.target.value = "";
  if (!file) return;
  uploading.value = true;
  error.value = "";
  try {
    const name =
      file.name.replace(/\.[^.]+$/, "").slice(0, 100) || "Своя декаль";
    images.value.unshift(await uploadMapDecal(file, name, "custom"));
  } catch (cause) {
    error.value = cause.message;
  } finally {
    uploading.value = false;
  }
}
</script>
<style scoped>
.map-decal-palette {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
</style>
