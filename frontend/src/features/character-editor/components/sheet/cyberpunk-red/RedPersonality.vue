<template>
  <div class="red-stack">
    <BaseTile :outlined="false"
      ><div class="red-panel">
        <h2>Личность</h2>
        <AvatarBlock
          :block="{
            id: 'red-avatar',
            props: { width: '100%', height: '260px' },
          }"
          :value="values.identity.avatar"
          @update:value="
            (_, avatar) =>
              emit('patch', { identity: { ...values.identity, avatar } })
          "
        /><FormField label="Имя / handle" vertical
          ><FormTextInput
            v-if="editable"
            :value="values.identity.handle"
            placeholder="Имя / handle"
            @update:value="
              emit('patch', {
                identity: { ...values.identity, handle: $event },
              })
            "
          /><strong v-else>{{ values.identity.handle }}</strong></FormField
        >
        <div class="red-form-grid">
          <FormField
            v-for="[key, label] in RED_LIFEPATH_FIELDS"
            :key="key"
            :label="label"
            vertical
            ><FormTextarea
              v-if="editable"
              :value="values.lifepath.general[key] || ''"
              :rows="2"
              @update:value="setLife('general', key, $event)"
            />
            <p v-else>{{ values.lifepath.general[key] || "—" }}</p></FormField
          >
        </div>
      </div></BaseTile
    ><BaseTile :outlined="false"
      ><div class="red-panel">
        <h2>Жизненный путь роли</h2>
        <div class="red-form-grid">
          <FormField
            v-for="[key, label] in roleFields"
            :key="key"
            :label="label"
            vertical
            ><FormTextarea
              v-if="editable"
              :value="values.lifepath.roleSpecific[key] || ''"
              :rows="2"
              @update:value="setLife('roleSpecific', key, $event)"
            />
            <p v-else>
              {{ values.lifepath.roleSpecific[key] || "—" }}
            </p></FormField
          >
        </div>
      </div></BaseTile
    ><BaseTile :outlined="false"
      ><div class="red-panel">
        <h2>Жизнь в городе</h2>
        <FormField label="Жильё" vertical
          ><FormTextInput
            v-if="editable"
            :value="values.economy.housingKey || ''"
            @update:value="setMoney('housingKey', $event)"
          /><span v-else>{{ values.economy.housingKey }}</span></FormField
        ><FormField label="Образ жизни" vertical
          ><FormTextInput
            v-if="editable"
            :value="values.economy.lifestyleKey || ''"
            @update:value="setMoney('lifestyleKey', $event)"
          /><span v-else>{{ values.economy.lifestyleKey }}</span></FormField
        ><FormField label="Репутация" vertical
          ><FormNumberInput
            v-if="editable"
            :value="values.progression.reputation"
            :min="0"
            :max="10"
            @change="
              emit('patch', {
                progression: { ...values.progression, reputation: $event },
              })
            "
          /><strong v-else>{{
            values.progression.reputation
          }}</strong></FormField
        >
      </div></BaseTile
    >
  </div>
</template>
<script setup>
import { computed } from "vue";
import AvatarBlock from "../../../blocks/generic/AvatarBlock.vue";
import {
  BaseTile,
  FormField,
  FormTextInput,
  FormTextarea,
  FormNumberInput,
} from "@sylvieshare/share-ui";
import {
  RED_LIFEPATH_FIELDS,
  RED_ROLE_LIFEPATH,
} from "../../../settings/cyberpunk-red/lifepath";
const props = defineProps({ values: Object, editable: Boolean });
const emit = defineEmits(["patch"]);
const roleFields = computed(
  () => RED_ROLE_LIFEPATH[props.values.roles[0]?.key] || [],
);
function setLife(group, key, value) {
  emit("patch", {
    lifepath: {
      ...props.values.lifepath,
      [group]: { ...props.values.lifepath[group], [key]: value },
    },
  });
}
function setMoney(key, value) {
  emit("patch", { economy: { ...props.values.economy, [key]: value } });
}
</script>
