<template>
  <AppModal @close="emit('close')"
    ><div class="red-panel">
      <h2>{{ result?.title || request.title }}</h2>
      <div
        v-if="!['damage', 'net-threat', 'injury'].includes(request.kind)"
        class="red-form-grid"
      >
        <FormField
          v-if="
            request.kind !== 'death' &&
            !['lawman', 'media'].includes(request.roleKey)
          "
          label="DV / результат защиты (необязательно)"
          vertical
          ><FormNumberInput
            :value="dv"
            :min="0"
            :max="100"
            @change="dv = $event"
        /></FormField>
        <FormField
          v-if="request.kind !== 'death' && request.roleKey !== 'lawman'"
          :label="
            request.roleKey === 'media'
              ? 'Бонус доказательств (0–3)'
              : 'Модификатор обстоятельств'
          "
          vertical
          ><FormNumberInput
            :value="modifier"
            :min="-100"
            :max="100"
            @change="modifier = $event"
        /></FormField>
        <FormField
          v-if="
            request.kind !== 'death' &&
            !['lawman', 'media'].includes(request.roleKey)
          "
          label="Потратить удачу"
          vertical
          ><FormNumberInput
            :value="luck"
            :min="0"
            :max="values.luck?.current || 0"
            @change="luck = $event"
        /></FormField>
      </div>
      <template v-if="request.kind === 'attack'">
        <FormField label="Режим" vertical
          ><FormSelect v-model:value="mode"
            ><option v-if="!weapon?.facts.autofireOnly" value="single">
              Обычная атака
            </option>
            <option v-if="!weapon?.facts.noAimed" value="aimed">
              Прицельная · −8
            </option>
            <option v-if="weapon?.facts.autofire" value="autofire">
              Автоогонь · {{ weapon?.facts.autofireAmmo || 10 }} патронов
            </option>
            <option v-if="weapon?.facts.suppressiveFire" value="suppressive">
              Подавление · 10 патронов
            </option></FormSelect
          ></FormField
        >
        <FormField v-if="mode === 'aimed'" label="Область попадания" vertical
          ><FormSelect v-model:value="location"
            ><option value="head">Голова · двойной прошедший урон</option>
            <option value="body">
              Рука / нога / предмет · особый эффект
            </option></FormSelect
          ></FormField
        >
        <FormField
          v-if="weapon?.facts.ranged && mode !== 'suppressive' && !dv"
          label="Дистанция, м · DV по таблице"
          vertical
          ><FormNumberInput
            :value="distance"
            :min="0"
            :max="800"
            @change="distance = $event"
        /></FormField>
        <FormField
          v-if="weapon?.facts.skill === 'martial-arts'"
          label="Стиль"
          vertical
          ><FormSelect v-model:value="skillUid"
            ><option value="">Выберите изученный стиль</option>
            <option v-for="s in martialSkills" :key="s.uid" :value="s.uid">
              {{ s.specialization }} · {{ s.rank }}
            </option></FormSelect
          ></FormField
        >
        <small
          >Уклонение бросается до атаки; его итог заменяет табличный DV.
          Равенство выигрывает защита.</small
        >
      </template>
      <FormField
        v-if="request.mode === 'program' && !request.targetNodeUid"
        label="Тип цели"
        vertical
        ><FormSelect v-model:value="targetType"
          ><option value="netrunner">Нетраннер</option>
          <option value="blackIce">Чёрный ЛЁД</option>
          <option value="program">Обычная программа</option></FormSelect
        ></FormField
      >
      <p v-if="request.mode === 'program' || request.mode === 'zap'">
        Без выбранного узла укажите в DV результат защиты цели.
      </p>
      <p v-if="request.kind === 'damage'">
        Урон последней атаки учитывает режим, боеприпасы и Слабое место Соло.
        Повторное применение этого броска не создаёт новый урон.
      </p>
      <p v-if="error" class="red-danger" role="alert">{{ error }}</p>
      <div v-if="result" aria-live="polite">
        <div class="red-metric">{{ result.total }}</div>
        <p>{{ result.expression }} · кости: {{ result.dice.join(", ") }}</p>
        <p v-if="result.critical">
          Дополнительный d10
          {{ result.critical === "failure" ? "вычитается" : "прибавляется" }}
          один раз.
        </p>
        <p v-if="result.opponentTotal != null">
          Защита цели: {{ result.opponentTotal }} (кости
          {{ result.opponentDice.join(", ") }})
        </p>
        <p v-if="result.damageDice?.length && request.kind !== 'damage'">
          Урон: {{ result.damage }} · кости {{ result.damageDice.join(", ") }}
        </p>
        <p v-if="result.damageOptions?.critical" class="red-danger">
          Критическая травма: +5 HP мимо брони. Бросьте травму отдельно для
          каждой цели.
        </p>
        <p v-if="result.effect">{{ result.effect }}</p>
        <p v-if="result.dv != null">DV {{ result.dv }}</p>
        <p v-if="result.success != null">
          {{ result.success ? "Успех" : "Неудача" }}
        </p>
        <small v-if="result.ammoSpent"
          >Израсходовано патронов: {{ result.ammoSpent }}</small
        >
      </div>
      <div class="red-actions">
        <ActionButton
          :disabled="busy || !ctx.ownerMode || !!result"
          @click="roll"
          >{{ busy ? "Бросок…" : "Бросить" }}</ActionButton
        ><ActionButton variant="quiet" @click="emit('close')"
          >Закрыть</ActionButton
        >
      </div>
      <small v-if="!ctx.ownerMode"
        >Предпросмотр и чужой лист доступны без изменения ресурсов.</small
      >
    </div></AppModal
  >
</template>
<script setup>
import { computed, inject, ref } from "vue";
import {
  AppModal,
  ActionButton,
  FormField,
  FormNumberInput,
  FormSelect,
} from "@sylvieshare/share-ui";
import { characterSheetContext } from "../../../lib/sheetContext";
const props = defineProps({ request: Object, items: Array }),
  emit = defineEmits(["close"]);
const ctx = inject("charCtx", {}),
  sheet = inject(characterSheetContext);
const values = computed(() => sheet.values.value),
  weapon = computed(() =>
    props.items?.find(
      (i) =>
        i.key ===
        values.value.inventory.entries.find(
          (e) => e.uid === props.request.entryUid,
        )?.key,
    ),
  );
const martialSkills = computed(() =>
  values.value.skills.filter((s) => s.key === "martial-arts" && s.rank > 0),
);
const dv = ref(props.request.dv || 0),
  modifier = ref(0),
  luck = ref(0),
  mode = ref("single"),
  location = ref("head"),
  distance = ref(6),
  skillUid = ref(""),
  targetType = ref(props.request.targetType || "netrunner"),
  result = ref(null),
  error = ref(""),
  busy = ref(false);
async function roll() {
  busy.value = true;
  error.value = "";
  try {
    if (
      props.request.kind === "attack" &&
      weapon.value?.facts.skill === "martial-arts" &&
      !skillUid.value
    )
      throw new Error("Выберите изученный стиль");
    result.value = await ctx.redCommands.roll({
      ...props.request,
      dv: dv.value || null,
      modifier: modifier.value,
      luck: luck.value,
      mode:
        props.request.kind === "attack" ? mode.value : props.request.mode || "",
      ...(props.request.kind === "attack"
        ? {
            location: mode.value === "aimed" ? location.value : "body",
            distance:
              weapon.value?.facts.ranged && !dv.value ? distance.value : null,
            skillUid: skillUid.value,
          }
        : {}),
      targetType: targetType.value,
      sessionUuid: ctx.topSession?.uuid || "",
    });
  } catch (e) {
    error.value = e.message;
  } finally {
    busy.value = false;
  }
}
</script>
