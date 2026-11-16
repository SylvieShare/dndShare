<template>
  <AppModal @close="emit('close')"
    ><div class="red-panel">
      <h2>{{ title }}</h2>
      <FormTextInput
        v-model:value="query"
        placeholder="Название на русском или английском…"
        aria-label="Поиск предмета"
      />
      <div class="red-list">
        <div
          v-for="item in filtered.slice(0, limit)"
          :key="item.key"
          class="red-row"
        >
          <div>
            <strong>{{ item.name }}</strong
            ><small
              >{{ item.nameEn }} · {{ item.facts.price }} eb{{
                item.facts.quantity > 1 ? ` / ${item.facts.quantity} шт.` : ""
              }}</small
            ><small v-if="item.facts.damage"
              >{{ item.facts.damage }} · ROF {{ item.facts.rof }}</small
            >
          </div>
          <ActionButton @click="emit('select', item)">Выбрать</ActionButton>
        </div>
      </div>
      <p v-if="!filtered.length">Совпадений нет.</p>
      <ActionButton v-if="filtered.length > limit" @click="limit += 40"
        >Показать ещё</ActionButton
      ><ActionButton variant="quiet" @click="emit('close')"
        >Закрыть</ActionButton
      >
    </div></AppModal
  >
</template>
<script setup>
import { computed, ref } from "vue";
import { AppModal, ActionButton, FormTextInput } from "@sylvieshare/share-ui";
const props = defineProps({
  items: Array,
  title: { type: String, default: "Выбрать из справочника" },
  kinds: Array,
});
const emit = defineEmits(["select", "close"]);
const query = ref(""),
  limit = ref(40);
const filtered = computed(() =>
  props.items.filter(
    (i) =>
      (!props.kinds?.length || props.kinds.includes(i.kind)) &&
      (i.name + " " + i.nameEn)
        .toLowerCase()
        .includes(query.value.toLowerCase()),
  ),
);
</script>
