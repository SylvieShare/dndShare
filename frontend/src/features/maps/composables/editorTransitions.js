import { transitionDocument } from "../lib/modelTransitions";
export function editorTransitions(e) {
  function applyTransition(kind, id, transition) {
    const result = transitionDocument(
      e.draft.value.document,
      e.catalogue.value,
      kind,
      id,
      transition,
    );
    if (!result.valid) {
      e.error.value = result.reason;
      return;
    }
    e.error.value = "";
    e.change((m) => {
      m.document = result.document;
    });
  }
  return { applyTransition };
}
