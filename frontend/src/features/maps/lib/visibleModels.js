export function visibleModels(catalogue) {
  return catalogue.filter((model) => !model.hidden);
}
