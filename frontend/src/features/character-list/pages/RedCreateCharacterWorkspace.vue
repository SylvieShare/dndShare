<template>
  <div class="red-wizard red-sheet">
    <header class="red-row">
      <div>
        <h1>Создание персонажа</h1>
        <small>Cyberpunk RED · Core 1.25</small>
      </div>
      <div class="red-actions">
        <ActionButton variant="quiet" @click="resetOpen = true"
          >Сбросить</ActionButton
        ><ActionButton variant="quiet" @click="exit">Закрыть</ActionButton>
      </div>
    </header>
    <div
      v-if="loading"
      class="red-skeleton"
      aria-label="Загрузка создания персонажа"
    />
    <p
      v-if="error || catalogue.error.value || wizard.storageError.value"
      class="red-danger"
      role="alert"
    >
      {{ error || catalogue.error.value || wizard.storageError.value
      }}<ActionButton v-if="catalogue.error.value" @click="catalogue.load"
        >Повторить</ActionButton
      >
    </p>
    <div v-if="!loading" class="red-wizard-layout">
      <nav class="red-step-rail" aria-label="Шаги создания">
        <ActionButton
          v-for="(name, index) in RED_CREATE_STEPS"
          :key="name"
          :aria-current="step === index ? 'step' : undefined"
          @click="step = index"
          >{{ index + 1 }}. {{ name }}</ActionButton
        >
      </nav>
      <main class="red-wizard-main">
        <RedCreationSteps
          :draft="draft"
          :step="step"
          :items="catalogue.items.value"
          :validation="wizard.validation.value"
          :shopping="wizard.shopping.value"
          :skill-values="wizard.skillValues.value"
          @patch="patch"
          @method="pendingChange = { kind: 'method', value: $event }"
          @role="pendingChange = { kind: 'role', value: $event }"
          @roll-stats="wizard.rollStats"
          @native-language="nativeLanguage"
          @specialization="specialization"
        />
        <footer class="red-wizard-footer">
          <ActionButton variant="quiet" @click="step > 0 ? step-- : exit()">{{
            step ? "Назад" : "Отмена"
          }}</ActionButton>
          <div class="red-actions">
            <ActionButton
              v-if="step === 7"
              :disabled="creating || !available"
              @click="preview"
              >Предпросмотр листа</ActionButton
            ><ActionButton
              :disabled="creating || !available"
              @click="step < 7 ? step++ : create()"
              >{{
                creating
                  ? "Создание…"
                  : step < 7
                    ? "Далее"
                    : "Создать персонажа"
              }}</ActionButton
            >
          </div>
        </footer>
      </main>
    </div>
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
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { ActionButton, ConfirmDialog } from "@sylvieshare/share-ui";
import { fetchGet, fetchPost } from "@/shared/api/http";
import { useAccountStore } from "@/stores/account";
import { useTemplateStore } from "@/stores/template";
import { setCharSeed } from "@/shared/lib/charSeed";
import { useRedCatalogue } from "@/features/character-editor/composables/useRedCatalogue";
import {
  useRedCreateWizard,
  RED_CREATE_STEPS,
} from "../composables/useRedCreateWizard";
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
const creating = computed(() => props.creating || submitting.value),
  error = computed(() => props.error || localError.value),
  available = computed(
    () => templateId.value && versionId.value && catalogue.items.value.length,
  );
function patch(value) {
  Object.assign(draft.value, value);
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
<style scoped>
.red-wizard {
  max-width: 1400px;
  margin: auto;
}
.red-wizard h1 {
  margin: 0;
  font-family: var(--font-ui);
  font-size: var(--type-title-size);
}
.red-wizard-layout {
  display: grid;
  grid-template-columns: 220px minmax(0, 1fr);
  gap: var(--spacing-section);
}
.red-step-rail {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-small);
  align-self: start;
  position: sticky;
  top: var(--layout-header);
}
.red-step-rail [aria-current="step"] {
  color: var(--accent-soft);
}
.red-wizard-main {
  min-width: 0;
  display: grid;
  gap: var(--spacing-section);
}
.red-wizard-footer {
  display: flex;
  justify-content: space-between;
  gap: var(--spacing-medium);
  padding-block: var(--spacing-large);
  position: sticky;
  bottom: 0;
  background: var(--bg);
  z-index: 2;
  flex-wrap: wrap;
}
@media (max-width: 1199px) {
  .red-wizard-layout {
    grid-template-columns: 1fr;
  }
  .red-step-rail {
    position: static;
    flex-direction: row;
    overflow: auto;
  }
  .red-step-rail > * {
    flex: none;
  }
  .red-wizard-footer {
    padding-bottom: calc(var(--spacing-large) + env(safe-area-inset-bottom));
  }
}
</style>
