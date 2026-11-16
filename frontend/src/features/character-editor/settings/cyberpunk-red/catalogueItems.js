export function redCatalogueItem(row) {
  return row.data
    ? {
        id: row.id,
        key: row.userId ? `custom-${row.id}` : row.data.red_key,
        name: row.name,
        nameEn: row.nameEn,
        kind: row.data.red_kind,
        facts: row.data.facts || {},
        page: row.contentSources?.[0]?.page,
        description: row.data.description || "",
      }
    : row;
}
export const redByKey = (items) =>
  Object.fromEntries(
    items.map(redCatalogueItem).map((item) => [item.key, item]),
  );
