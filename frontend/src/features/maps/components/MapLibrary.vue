<template>
  <div class="map-library">
    <div class="map-library-heading">
      <SlidingTabs
        v-model="c.scope"
        :tabs="TABS"
        aria-label="Разделы карт"
      /><ActionButton v-if="!picker" @click="c.create"
        ><template #icon><Plus :size="17" /></template>Создать
        карту</ActionButton
      >
    </div>
    <div class="map-library-toolbar">
      <FormTextInput
        v-model:value="c.query"
        placeholder="Название или тег…"
        aria-label="Поиск карт"
      /><SearchMultiSelect
        v-model="c.selectedTags"
        :options="c.tagOptions"
        label="Теги карт"
        placeholder="Найти тег…"
        empty-label="Теги не найдены"
        remove-label="Убрать тег"
      />
      <div
        class="map-library-layout"
        role="group"
        aria-label="Отображение карт"
      >
        <ActionButton
          v-for="option in LAYOUTS"
          :key="option.key"
          icon-only
          variant="secondary"
          :aria-pressed="c.layout === option.key"
          :aria-label="option.label"
          :title="option.label"
          @click="c.layout = option.key"
          ><template #icon><component :is="option.icon" :size="18" /></template
        ></ActionButton>
      </div>
    </div>
    <div
      v-if="c.error && !c.preview && !c.pending"
      class="map-error"
      role="alert"
    >
      {{ c.error
      }}<ActionButton variant="quiet" @click="c.load()">Повторить</ActionButton>
    </div>
    <Transition
      name="map-library-content"
      mode="out-in"
      @before-leave="retireEntry"
      @before-enter="reviveEntry"
      @leave-cancelled="reviveEntry"
    >
      <LoadingState v-if="c.loading" key="loading" label="Загружаем карты…" />
      <div
        v-else-if="!c.filtered.length"
        :key="`empty-${c.scope}`"
        class="map-empty"
      >
        <Map :size="40" /><strong>{{
          c.query || c.selectedTags.length
            ? "Ничего не найдено"
            : EMPTY[c.scope].title
        }}</strong
        ><span>{{
          c.query || c.selectedTags.length
            ? "Попробуйте изменить поиск и теги."
            : EMPTY[c.scope].text
        }}</span>
      </div>
      <TransitionGroup
        v-else
        :key="c.scope"
        name="map-library-entry"
        @before-leave="retireEntry"
        @before-enter="reviveEntry"
        @leave-cancelled="reviveEntry"
        tag="div"
        class="map-library-entries"
        :class="{ 'map-library-entries--grid': c.layout === 'grid' }"
        ><MapLibraryEntry
          v-for="map in c.filtered"
          :key="map.id"
          :map="map"
          :layout="c.layout"
          :picker="picker"
          :busy="c.busy.has(map.id)"
          @open="c.open"
          @select="emit('select', $event)"
          @copy="c.duplicate"
          @subscribe="c.subscription"
          @rate="c.rate"
          @publish="c.confirm('publish', $event)"
          @delete="c.confirm('delete', $event)"
      /></TransitionGroup>
    </Transition>
    <AppModalFrame
      v-if="c.preview"
      :title="c.preview.name"
      fullscreen
      :padded="false"
      :body-scroll="false"
      close-label="Закрыть просмотр карты"
      @close="c.preview = null"
    >
      <template #header-actions
        ><ActionButton
          v-if="!c.preview.owned"
          :disabled="c.busy.has(c.preview.id)"
          variant="secondary"
          @click="c.subscription(c.preview)"
          ><template #icon><BookmarkPlus :size="16" /></template
          >{{
            c.preview.subscribed ? "Отписаться" : "Подписаться"
          }}</ActionButton
        ><ActionButton
          v-if="c.preview.owned || c.preview.subscribed"
          :disabled="c.busy.has(c.preview.id)"
          @click="c.duplicate(c.preview)"
          ><template #icon><Copy :size="16" /></template>Создать
          копию</ActionButton
        ><ActionButton
          v-if="picker && (c.preview.owned || c.preview.subscribed)"
          @click="
            emit('select', c.preview);
            c.preview = null;
          "
          >Выбрать</ActionButton
        ></template
      >
      <div v-if="c.error" class="map-error" role="alert">
        {{ c.error
        }}<ActionButton variant="quiet" @click="c.open(c.preview)"
          >Повторить</ActionButton
        >
      </div>
      <MapCanvas
        v-if="c.preview.document"
        :document="c.preview.document"
        master
        readonly
      /><LoadingState v-else-if="!c.error" label="Открываем карту…" />
    </AppModalFrame>
    <ConfirmDialog
      v-if="c.pending"
      :title="
        c.pending.kind === 'publish' ? 'Опубликовать карту?' : 'Удалить карту?'
      "
      :message="
        c.error ||
        (c.pending.kind === 'publish'
          ? `«${c.pending.map.name}» появится в бесплатном каталоге. Изменять и удалять опубликованную заготовку нельзя; для доработки создайте копию.`
          : `«${c.pending.map.name}» исчезнет из ваших карт. Копии в сессиях сохранятся.`)
      "
      :confirm-label="c.pending.kind === 'publish' ? 'Опубликовать' : 'Удалить'"
      :loading="c.confirming"
      :variant="c.pending.kind === 'publish' ? 'warning' : 'danger'"
      @confirm="c.apply"
      @cancel="c.pending = null"
    />
  </div>
</template>
<script setup>
import "../styles/maps.css";
import { defineAsyncComponent, reactive } from "vue";
import {
  ActionButton,
  AppModalFrame,
  ConfirmDialog,
  FormTextInput,
  LoadingState,
  SearchMultiSelect,
  SlidingTabs,
} from "@sylvieshare/share-ui";
import { BookmarkPlus, Copy, LayoutGrid, List, Map, Plus } from "@lucide/vue";
import { useMapLibrary } from "../composables/useMapLibrary";
import MapLibraryEntry from "./MapLibraryEntry.vue";
const MapCanvas = defineAsyncComponent(() => import("./MapCanvas.vue"));
const props = defineProps({ picker: Boolean }),
  emit = defineEmits(["select"]);
const c = reactive(useMapLibrary(props, emit));
const TABS = [
  { key: "own", title: "Мои" },
  { key: "subscriptions", title: "Подписки" },
  { key: "catalogue", title: "Каталог" },
];
const LAYOUTS = [
  { key: "grid", label: "Плитки", icon: LayoutGrid },
  { key: "list", label: "Список", icon: List },
];
function retireEntry(element) {
  element.inert = true;
  element.setAttribute("aria-hidden", "true");
}
function reviveEntry(element) {
  element.inert = false;
  element.removeAttribute("aria-hidden");
}
const EMPTY = {
  own: {
    title: "Своих карт пока нет",
    text: "Создайте карту или сделайте личную копию карты из подписок.",
  },
  subscriptions: {
    title: "Пока нет подписок",
    text: "Откройте каталог и подпишитесь на карты для своих сессий.",
  },
  catalogue: {
    title: "Каталог пока пуст",
    text: "Опубликуйте свою карту — другие смогут бесплатно использовать её.",
  },
};
</script>
<style scoped>
.map-library {
  display: flex;
  flex-direction: column;
  min-height: 0;
  gap: 22px;
}
.map-library-heading,
.map-library-toolbar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
}
.map-library-heading {
  justify-content: space-between;
}
.map-library-toolbar > input {
  max-width: 300px;
}
.map-library-layout {
  display: flex;
  gap: 4px;
  margin-left: auto;
}
.map-library-layout [aria-pressed="true"] {
  color: var(--accent);
}
.map-library-entries {
  display: grid;
  gap: 18px;
}
.map-library-entries--grid {
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
}
.map-library-content-enter-active,
.map-library-content-leave-active,
.map-library-entry-enter-active,
.map-library-entry-leave-active {
  transition:
    opacity 160ms ease,
    transform 160ms ease;
}
.map-library-content-enter-from,
.map-library-content-leave-to,
.map-library-entry-enter-from,
.map-library-entry-leave-to {
  opacity: 0;
  transform: translateY(5px);
}
.map-library-entry-move {
  transition: transform 180ms ease;
}
@media (prefers-reduced-motion: reduce) {
  .map-library-content-enter-active,
  .map-library-content-leave-active,
  .map-library-entry-enter-active,
  .map-library-entry-leave-active,
  .map-library-entry-move {
    transition: none;
  }
}
</style>
