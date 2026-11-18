<template>
  <div class="cc red-wizard" :class="{ 'cc--embedded': embedded }">
    <CharacterCreationHeader
      class="cc-head"
      red
      :scroll-source="mainRef"
      @close="exit"
      @reset="resetOpen = true"
    />
    <div class="cc-body cc-body--compact-steps">
      <CreateStepRail
        class="cc-rail"
        compact
        :sequential="false"
        :steps="steps"
        :current="step"
        :reachable="lastStep"
        @go="step = $event"
        @reset="resetOpen = true"
      />
      <main ref="mainRef" class="cc-main red-wizard-main">
        <p v-if="displayError" class="red-danger" role="alert">
          {{ displayError }}
          <ActionButton v-if="catalogue.error.value" @click="catalogue.load">Повторить</ActionButton>
        </p>
        <LoadingState v-if="loading || catalogue.loading.value && !catalogue.items.value.length" label="Загрузка создания персонажа…" />
        <Transition v-else name="cc-fade" mode="out-in">
          <RedCreationSteps
            :key="step"
            :draft="draft"
            :step="step"
            :items="catalogue.items.value"
            :art="art"
            :validation="wizard.validation.value"
            :shopping="wizard.shopping.value"
            :skill-values="wizard.skillValues.value"
            @patch="patch"
            @method="requestChange('method', $event)"
            @role="requestChange('role', $event)"
            @roll-stats="wizard.rollStats"
            @native-language="nativeLanguage"
            @specialization="specialization"
          />
        </Transition>
      </main>
    </div>
    <footer class="cc-foot">
      <div class="cc-foot-main">
        <ActionButton variant="quiet" @click="step > 0 ? step-- : exit()">
          {{ step ? "Назад" : "Отмена" }}
        </ActionButton>
        <div class="cc-actions">
          <ActionButton v-if="step === lastStep" variant="quiet" :disabled="creating || !available" @click="preview">
            Предпросмотр листа
          </ActionButton>
          <ActionButton :disabled="creating || !available" @click="step < lastStep ? step++ : create()">
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
      v-if="pendingChange"
      title="Изменить способ создания или роль?"
      message="Характеристики и навыки будут приведены к новому методу, ролевые выборы и комплект будут пересобраны. Имя, жизненный путь и покупки сохранятся; бюджеты проверятся заново."
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
  pendingChange = ref(null);
const art = useRedCreationArt();
const mainRef = ref(null);
const lastStep = RED_CREATE_STEPS.length - 1;
const summaries = computed(() => ({
  Правила: "Cyberpunk RED · Core 1.25",
  Роль: RED_ROLES.find(role => role.key === draft.value.role)?.name,
  Завершение: draft.value.name.trim(),
}));
const steps = computed(() => RED_CREATE_STEPS.map(title => ({
  key: title,
  title,
  summary: summaries.value[title],
})));
watch(step, () => { if (mainRef.value) mainRef.value.scrollTop = 0; });
const creating = computed(() => props.creating || submitting.value),
  error = computed(() => props.error || localError.value),
  displayError = computed(() => error.value || catalogue.error.value || wizard.storageError.value),
  available = computed(
    () => templateId.value && versionId.value && catalogue.items.value.length,
  );
function patch(value) {
  Object.assign(draft.value, value);
}
function requestChange(kind, value) {
  if (draft.value[kind] !== value) pendingChange.value = { kind, value };
}
function applyChange() {
  const change = pendingChange.value;
  pendingChange.value = null;
  if (change.kind === "role") wizard.changeRole(change.value);
  else wizard.changeMethod(change.value);
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
function getPayload() {
  if (!available.value)
    throw new Error("Система или справочник RED ещё недоступны");
  return {
    templateId: templateId.value,
    sourceVersionId: versionId.value,
    data: wizard.payload(),
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
async function create() {
  if (creating.value) return;
  localError.value = "";
  try {
    const payload = getPayload();
    if (account.authStatus !== "success") {
      window.dispatchEvent(
        new CustomEvent("dndshare:request-auth", {
          detail: { reason: "create-character" },
        }),
      );
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
</style>
