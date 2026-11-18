<template>
  <div class="cc red-wizard" :class="{ 'cc--embedded': embedded }">
    <CharacterCreationHeader
      class="cc-head"
      red
      :scroll-source="mainRef"
      :show-incomplete="!fullyValid"
      :creating="creating"
      :incomplete-disabled="!available"
      @close="exit"
      @reset="resetOpen = true"
      @create-incomplete="requestIncomplete"
    />
    <div class="cc-body">
      <CreateStepRail
        class="cc-rail"
        :steps="steps"
        :current="step"
        :reachable="reachableStep"
        @go="goTo"
      />
      <main ref="mainRef" class="cc-main red-wizard-main">
        <p v-if="displayError" class="red-danger" role="alert">
          {{ displayError }}
          <ActionButton v-if="catalogue.error.value" @click="catalogue.load">Повторить</ActionButton>
        </p>
        <LoadingState v-if="loading || catalogue.loading.value && !catalogue.items.value.length" label="Загрузка создания персонажа…" />
        <Transition v-else name="cc-fade" mode="out-in">
          <RedCreationSteps
            :key="stepKey"
            :draft="draft"
            :step="stepKey"
            :role-expanded="roleExpanded"
            :items="catalogue.items.value"
            :art="art"
            :validation="wizard.validation.value"
            :shopping="stepKey === 'equipment' ? wizard.equipmentShopping.value : wizard.shopping.value"
            :skill-values="wizard.skillValues.value"
            @patch="patch"
            @method="requestChange('method', $event)"
            @role="selectRole"
            @browse-roles="roleExpanded = false"
            @roll-stats="wizard.rollStats"
            @native-language="nativeLanguage"
            @specialization="specialization"
          />
        </Transition>
      </main>
    </div>
    <footer class="cc-foot">
      <div class="cc-foot-main">
        <p v-if="blockReason" class="red-step-reason" role="status">{{ blockReason }}</p>
        <ActionButton variant="quiet" @click="step > 0 ? step-- : exit()">
          {{ step ? "Назад" : "Отмена" }}
        </ActionButton>
        <div class="cc-actions">
          <ActionButton v-if="step === lastStep" variant="quiet" :disabled="creating || !available || !fullyValid" @click="preview">
            Предпросмотр листа
          </ActionButton>
          <ActionButton :disabled="creating || !available || !!blockReason" @click="advance">
            {{ creating ? "Создание…" : step < lastStep ? "Далее" : "Создать персонажа" }}
          </ActionButton>
        </div>
      </div>
    </footer>
    <CharacterSheetModal
      v-if="previewDraft"
      :draft="previewDraft"
      @close="previewDraft = null"
    />
    <ConfirmDialog
      v-if="incompleteOpen"
      title="Создать неполноценного персонажа?"
      message="Можно закончить настройку в листе. Неуказанные характеристики получат минимальные значения. Недопустимые настройки и покупки могут быть исключены."
      confirm-label="Создать"
      @cancel="incompleteOpen = false"
      @confirm="create({ incomplete: true })"
    />
    <ConfirmDialog
      v-if="pendingChange"
      :title="pendingChange.kind === 'role' ? 'Изменить роль?' : 'Изменить способ создания?'"
      :message="pendingChange.kind === 'role'
        ? 'Навыки, специальные настройки и стартовый комплект будут пересобраны под новую роль.'
        : 'Навыки будут пересобраны, а характеристики и бюджет будут рассчитываться по новому способу.'"
      confirm-label="Изменить"
      @cancel="pendingChange = null"
      @confirm="applyChange"
    />
    <ConfirmDialog
      v-if="resetOpen"
      title="Сбросить черновик RED?"
      message="Выборы этого черновика будут удалены. Сохранённые персонажи останутся."
      confirm-label="Сбросить"
      @cancel="resetOpen = false"
      @confirm="
        wizard.reset();
        roleExpanded = false;
        resetOpen = false;
      "
    />
  </div>
</template>
<script setup>
import { computed, onMounted, ref, watch } from "vue";
import { useRouter } from "vue-router";
import { ActionButton, ConfirmDialog, LoadingState } from "@sylvieshare/share-ui";
import { fetchGet, fetchPost } from "@/shared/api/http";
import { useAccountStore } from "@/stores/account";
import { useTemplateStore } from "@/stores/template";
import { setCharSeed } from "@/shared/lib/charSeed";
import { useRedCatalogue } from "@/features/character-editor/composables/useRedCatalogue";
import {
  useRedCreateWizard,
  RED_CREATE_STEPS,
} from "../composables/useRedCreateWizard";
import { RED_ROLES } from "@/features/character-editor/settings/cyberpunk-red/catalogue";
import { useRedCreationArt } from "../composables/useRedCreationArt";
import { redCreationStepError } from "../composables/redCreationStepValidation";
import CharacterCreationHeader from "../components/CharacterCreationHeader.vue";
import CreateStepRail from "../components/wizard/CreateStepRail.vue";
import RedCreationSteps from "../components/wizard/red/RedCreationSteps.vue";
import CharacterSheetModal from "@/features/character-editor/components/CharacterSheetModal.vue";
const props = defineProps({
  embedded: Boolean,
  creating: Boolean,
  error: String,
  sourceVersionId: Number,
});
const emit = defineEmits(["create", "cancel"]);
const router = useRouter(),
  account = useAccountStore(),
  templates = useTemplateStore(),
  catalogue = useRedCatalogue(),
  wizard = useRedCreateWizard(catalogue.items);
const { draft, step } = wizard,
  loading = ref(true),
  localError = ref(""),
  submitting = ref(false),
  templateId = ref(null),
  versionId = ref(null),
  previewDraft = ref(null),
  resetOpen = ref(false),
  incompleteOpen = ref(false),
  pendingChange = ref(null);
const art = useRedCreationArt();
const mainRef = ref(null);
const roleExpanded = ref(false);
const lastStep = RED_CREATE_STEPS.length - 1;
const stepKey = computed(() => RED_CREATE_STEPS[step.value].key);
const summaries = computed(() => ({
  method: "Cyberpunk RED · Core 1.25",
  role: RED_ROLES.find(role => role.key === draft.value.role)?.name,
  finish: draft.value.name.trim(),
}));
const steps = computed(() => RED_CREATE_STEPS.map(entry => ({
  ...entry,
  summary: summaries.value[entry.key],
})));
watch(step, () => { if (mainRef.value) mainRef.value.scrollTop = 0; });
const creating = computed(() => props.creating || submitting.value),
  error = computed(() => props.error || localError.value),
  displayError = computed(() => error.value || catalogue.error.value || wizard.storageError.value),
  available = computed(
    () => templateId.value && versionId.value && catalogue.items.value.length,
  );
const firstInvalid = computed(() => {
  for (const [index, entry] of RED_CREATE_STEPS.entries()) {
    const reason = redCreationStepError(entry.key, draft.value, wizard.validation.value, catalogue.items.value);
    if (reason) return { index, reason };
  }
  return null;
});
const reachableStep = computed(() => firstInvalid.value?.index ?? lastStep);
const fullyValid = computed(() => firstInvalid.value === null);
const blockReason = computed(() => firstInvalid.value?.index === step.value ? firstInvalid.value.reason : "");

watch([available, reachableStep], ([ready, reachable]) => {
  if (ready && step.value > reachable) step.value = reachable;
}, { immediate: true });

function goTo(index) {
  if (index <= reachableStep.value) step.value = index;
}
function advance() {
  if (!available.value || creating.value || blockReason.value) return;
  if (step.value < lastStep) goTo(step.value + 1);
  else create();
}
function patch(value) {
  Object.assign(draft.value, value);
}
function requestChange(kind, value) {
  if (draft.value[kind] !== value) pendingChange.value = { kind, value };
}
function selectRole(value) {
  if (value === draft.value.role) roleExpanded.value = true;
  else requestChange("role", value);
}
function applyChange() {
  const change = pendingChange.value;
  pendingChange.value = null;
  if (change.kind === "role") {
    wizard.changeRole(change.value);
    roleExpanded.value = true;
  } else wizard.changeMethod(change.value);
}
function nativeLanguage(value) {
  const old = draft.value.nativeLanguage;
  draft.value.nativeLanguage = value;
  draft.value.skills = draft.value.skills.map((s) =>
    s.key === "language" && s.specialization === old
      ? { ...s, specialization: value }
      : s,
  );
}
function specialization({ key, value }) {
  const old = draft.value.specializations[key];
  draft.value.specializations[key] = value;
  draft.value.skills = draft.value.skills.map((s) =>
    s.key === key && s.specialization === old
      ? { ...s, specialization: value }
      : s,
  );
}
function exit() {
  if (props.embedded) emit("cancel");
  else router.push("/chars");
}
function getPayload({ incomplete = false } = {}) {
  if (!available.value)
    throw new Error("Система или справочник RED ещё недоступны");
  return {
    templateId: templateId.value,
    sourceVersionId: versionId.value,
    data: wizard.payload({ incomplete }),
  };
}
function preview() {
  try {
    localError.value = "";
    previewDraft.value = {
      ...getPayload(),
      templateName: "CYBERPUNK_RED",
      sourceName: "Cyberpunk",
      sourceVersion: "RED",
      version: 0,
      publicVisible: false,
      userId: null,
    };
  } catch (e) {
    localError.value = e.message;
  }
}
function requestAuth() {
  window.dispatchEvent(new CustomEvent("dndshare:request-auth", {
    detail: { reason: "create-character" },
  }));
}
function requestIncomplete() {
  if (!available.value || creating.value) return;
  if (account.authStatus === "success") incompleteOpen.value = true;
  else requestAuth();
}
async function create({ incomplete = false } = {}) {
  incompleteOpen.value = false;
  if (creating.value || (!incomplete && !fullyValid.value)) return;
  localError.value = "";
  try {
    const payload = getPayload({ incomplete });
    if (account.authStatus !== "success") {
      requestAuth();
      return;
    }
    if (props.embedded) {
      emit("create", payload);
      return;
    }
    submitting.value = true;
    const result = await fetchPost("/chars", payload);
    if (!result.uuid) throw new Error("Сервер не вернул персонажа");
    const saved = await fetchGet(`/char/${result.uuid}`);
    setCharSeed(result.uuid, { ...saved, templateId: templateId.value });
    wizard.clearDraft();
    account.setHasCharacters(true);
    await router.push(`/char/${result.uuid}`);
  } catch (e) {
    localError.value = e.message || "Не удалось создать персонажа";
  } finally {
    submitting.value = false;
  }
}
onMounted(async () => {
  try {
    const [, response] = await Promise.all([
      templates.ensure(),
      fetchGet("/sources"),
    ]);
    templateId.value = templates.all.find(
      (t) => t.name === "CYBERPUNK_RED",
    )?.id;
    const source = response.sources.find((s) => s.name === "Cyberpunk");
    versionId.value =
      props.sourceVersionId ||
      source?.versions?.find((v) => v.version === "RED")?.id;
    if (source?.id) void art.load(source.id);
    if (!templateId.value || !versionId.value)
      throw new Error("Cyberpunk RED ещё не подключён к этому серверу");
  } catch (e) {
    localError.value = e.message;
  } finally {
    loading.value = false;
  }
});
defineExpose({ clearDraft: wizard.clearDraft });
</script>
<style
  src="../../character-editor/components/sheet/cyberpunk-red/redSheet.css"
></style>
<style scoped src="../components/wizard/creationWorkspace.css"></style>
<style scoped>
.red-wizard-main { padding-block-start: var(--spacing-medium); }
.red-wizard-main > [role="alert"] { margin: 0 0 var(--spacing-medium); }
.cc-foot-main { flex-wrap: wrap; }
.red-step-reason {
  flex: 1 1 100%;
  margin: 0;
  color: var(--text-muted);
  font-size: var(--type-group-size);
}
</style>
