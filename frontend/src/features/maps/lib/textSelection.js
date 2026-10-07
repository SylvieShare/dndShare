// Keep the native clipboard when the user has selected text in the catalogue or inspector.
export function hasSelectedText() {
  return !!window.getSelection()?.toString().trim();
}
export function isSelectableText(event) {
  return !!event.target?.closest?.(".map-model-name, .map-model-card small");
}
