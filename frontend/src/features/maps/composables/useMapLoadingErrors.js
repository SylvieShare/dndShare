import { computed, ref, watch } from "vue";
import { modelLoadError } from "../lib/modelLoadError";
export function useMapLoadingErrors(downloads) {
  const permanent = ref([]),
    open = ref(false);
  let seen = new Set();
  const issues = computed(() =>
    [...(downloads.value?.errors || []), ...permanent.value].filter(
      (issue, index, all) =>
        all.findIndex((other) => other.key === issue.key) === index,
    ),
  );
  watch(
    issues,
    (list) => {
      const keys = new Set(list.map((issue) => issue.key));
      if (list.some((issue) => !seen.has(issue.key))) open.value = true;
      seen = keys;
      if (!keys.size) open.value = false;
    },
    { deep: true },
  );
  function report(cause, context = {}) {
    if (cause?.name === "AbortError") return;
    const issue = modelLoadError(cause, {
      stage: cause?.stage || context.stage || "scene",
      retryable: cause?.retryable ?? false,
    });
    permanent.value = [
      ...permanent.value.filter((item) => item.key !== issue.key),
      issue,
    ];
  }
  return {
    issues,
    open,
    report,
    reset() {
      permanent.value = [];
      open.value = false;
    },
  };
}
