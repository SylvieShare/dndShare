export function tokenModelId(token, catalogue) {
  if (
    token.dead || token.kind !== "creature" ||
    !Number.isSafeInteger(token.itemId) ||
    token.itemId <= 0
  )
    return "";
  return (
    catalogue.find((model) => model.itemIds?.includes(token.itemId))?.id || ""
  );
}

export function tokenItemIds(tokens = []) {
  return [
    ...new Set(
      tokens
        .filter(
          (t) =>
            !t.dead && t.kind === "creature" &&
            Number.isSafeInteger(t.itemId) &&
            t.itemId > 0,
        )
        .map((t) => t.itemId),
    ),
  ].sort((a, b) => a - b);
}
