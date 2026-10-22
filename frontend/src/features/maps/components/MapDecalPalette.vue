<template>
  <section class="map-decal-palette" aria-label="Каталог декалей">
    <FormSelect v-model:value="category" aria-label="Категория декалей">
      <option v-for="item in DECAL_CATEGORIES" :key="item.id" :value="item.id">
        {{ item.name }}
      </option>
    </FormSelect>
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
      PNG, JPG или WebP до 8 МБ. Выберите изображение и нажмите на поверхность
      модели.
    </p>
    <p v-if="error" role="alert" class="map-error">{{ error }}</p>
    <div class="map-decal-grid">
      <BaseTile
        v-for="image in filtered"
        :key="image.id"
        interactive
        framed
        role="button"
        tabindex="0"
        :aria-label="`Разместить: ${image.name}`"
        class="map-decal-card"
        @click="emit('place', image)"
        @keydown.enter.self.prevent="emit('place', image)"
        @keydown.space.self.prevent="emit('place', image)"
      >
        <img :src="image.imageUrl" alt="" draggable="false" />
        <span>{{ image.name }}</span>
      </BaseTile>
    </div>
    <p v-if="!filtered.length" class="map-hint">
      В этой категории пока нет изображений. Можно загрузить своё.
    </p>
    <MapInspectorSection v-if="placed.length" title="На карте">
      <ActionButton
        v-for="item in placed"
        :key="item.id"
        variant="quiet"
        @click="editor.selectDecal(item.id)"
        >{{ item.name }}</ActionButton
      >
    </MapInspectorSection>
  </section>
</template>
<script setup>
import { computed, onMounted, ref } from "vue";
import { ActionButton, BaseTile, FormSelect } from "@sylvieshare/share-ui";
import { Upload } from "@lucide/vue";
import { BUILTIN_DECALS, DECAL_CATEGORIES } from "../lib/mapDecals";
import { getMapDecals, uploadMapDecal } from "@/shared/api/mapDecalsApi";
import MapInspectorSection from "./MapInspectorSection.vue";
const props = defineProps({ editor: Object });
const emit = defineEmits(["place"]);
const category = ref("traces"),
  images = ref([]),
  error = ref(""),
  uploading = ref(false),
  fileInput = ref(null);
const placed = computed(() => props.editor.draft.document.decals || []);
const filtered = computed(() =>
  category.value === "custom"
    ? images.value
    : [...BUILTIN_DECALS, ...images.value].filter(
        (i) => i.category === category.value,
      ),
);
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
    const image = await uploadMapDecal(file, name, category.value);
    images.value.unshift(image);
    emit("place", image);
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
  padding: 12px;
}
.map-decal-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}
.map-decal-card {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 8px;
  font-size: 12px;
}
.map-decal-card img {
  width: 100%;
  height: 100px;
  object-fit: contain;
}
</style>
