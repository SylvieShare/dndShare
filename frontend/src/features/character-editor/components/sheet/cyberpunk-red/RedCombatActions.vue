<template>
  <BaseTile :outlined="false"
    ><div class="red-panel">
      <h2>Действия в бою</h2>
      <p>
        Ход: одно перемещение и одно действие. ROF 2 позволяет две атаки за
        действие; прицельная атака всегда одна. Дистанция обычного перемещения —
        MOVE × 2 м.
      </p>
      <div class="red-actions">
        <ActionButton v-if="editable" @click="newTurn">Новый ход</ActionButton
        ><ActionButton @click="skill('evasion', 'Уклонение')"
          >Уклонение</ActionButton
        ><ActionButton @click="skill('brawling', 'Захват / освобождение')"
          >Захват</ActionButton
        ><ActionButton @click="skill('concentration', 'Против подавления')"
          >Против подавления</ActionButton
        ><ActionButton
          @click="
            skill(
              'first-aid',
              'Стабилизация',
              values.health.current <= 0
                ? 15
                : values.health.current < maximum / 2
                  ? 13
                  : 10,
            )
          "
          >Первая помощь</ActionButton
        >
      </div>
      <small
        >Уклоняться от стрельбы можно при REF 8+. Захват — встречный Brawling;
        оба получают −2 к действиям, жертва не перемещается самостоятельно.
        Удушение и бросок уже захваченной цели не требуют новой проверки: BODY
        урона без SP; удушение оставляет минимум 1 HP и лишает сознания, бросок
        сбивает с ног.</small
      >
      <template v-if="styles.length"
        ><h3>Приёмы боевых искусств</h3>
        <FormSelect v-model:value="style"
          ><option value="">Выберите изученный стиль</option>
          <option v-for="s in styles" :key="s.uid" :value="s.uid">
            {{ s.specialization }}
          </option></FormSelect
        >
        <div class="red-actions">
          <ActionButton
            :disabled="!style"
            @click="martial('Быстрый подъём', 13)"
            >Быстрый подъём · DV 13</ActionButton
          ><ActionButton :disabled="!style" @click="martial('Спецприём', 15)"
            >Спецприём · DV 15</ActionButton
          >
        </div>
        <p>
          Айкидо: после Brawling и Martial Arts по одной цели — обезоруживание;
          уже захваченную цель можно удержать железной хваткой. Карате: после
          Melee и Martial Arts по одной цели — ещё −2 SP; при WILL 8+ вместо
          двух атак можно сломать рёбра. Дзюдо: после уклонения от всех ближних
          атак — контрбросок; после двух ударов захватчика — выход с переломом
          руки. Тхэквондо: WILL 8+ — удар с травмой позвоночника; MOVE 8+ и
          разбег 4 м — летящий удар, сбивающий с ног. Условия и специальные
          травмы подтверждает ведущий.
        </p></template
      >
      <small
        >Попадание в голову удваивает прошедший урон; треснувший череп
        утраивает. Прицельное попадание в ногу с пробитием SP вызывает перелом
        ноги. Критическую травму после броска урона добавьте в блоке
        травм.</small
      >
    </div></BaseTile
  >
</template>
<script setup>
import { computed, ref } from "vue";
import { BaseTile, ActionButton, FormSelect } from "@sylvieshare/share-ui";
const props = defineProps({
    values: Object,
    maximum: Number,
    editable: Boolean,
  }),
  emit = defineEmits(["patch", "roll"]);
const styles = computed(() =>
    props.values.skills.filter((s) => s.key === "martial-arts" && s.rank > 0),
  ),
  style = ref("");
function skill(key, title, dv) {
  const s = props.values.skills.find((s) => s.key === key);
  emit("roll", {
    kind: "check",
    skillKey: key,
    skillUid: s?.uid || "",
    title,
    dv,
  });
}
function martial(title, dv) {
  emit("roll", {
    kind: "check",
    skillKey: "martial-arts",
    skillUid: style.value,
    title,
    dv,
  });
}
function newTurn() {
  emit("patch", {
    combat: {
      ...props.values.combat,
      spotWeaknessUsed: false,
      damageDeflectionUsed: false,
    },
  });
}
</script>
