const copy = (value) =>
  value === undefined ? undefined : JSON.parse(JSON.stringify(value));
const entityList = (value) =>
  Array.isArray(value) &&
  value.every(
    (item) => item && typeof item === "object" && typeof item.id === "string",
  );
const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// Persistent history stores changed records/fields, never fifty whole maps.
export function documentChanges(before, after) {
  const changes = [];
  function visit(a, b, path) {
    if (a === b) return;
    if (entityList(a) && entityList(b) && (a.length || b.length)) {
      const old = new Map(a.map((item, i) => [item.id, { item, index: i }]));
      const next = new Map(b.map((item, i) => [item.id, { item, index: i }]));
      const records = [];
      for (const id of new Set([...old.keys(), ...next.keys()])) {
        const previous = old.get(id),
          current = next.get(id);
        if (!equal(previous?.item, current?.item))
          records.push({
            id,
            before: copy(previous?.item),
            after: copy(current?.item),
            oldIndex: previous?.index,
            newIndex: current?.index,
          });
      }
      const commonOld = a
        .filter((item) => next.has(item.id))
        .map((item) => item.id);
      const commonNext = b
        .filter((item) => old.has(item.id))
        .map((item) => item.id);
      const order = equal(commonOld, commonNext)
        ? null
        : [a.map((item) => item.id), b.map((item) => item.id)];
      if (records.length || order) changes.push({ path, records, order });
      return;
    }
    if (
      a &&
      b &&
      typeof a === "object" &&
      typeof b === "object" &&
      !Array.isArray(a) &&
      !Array.isArray(b)
    ) {
      for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
        if (
          !path.length &&
          ["id", "revision", "changedAt", "previewUrl"].includes(key)
        )
          continue;
        visit(a[key], b[key], [...path, key]);
      }
    } else if (!equal(a, b))
      changes.push({ path, before: copy(a), after: copy(b) });
  }
  visit(before, after, []);
  return changes;
}

export function applyDocumentChanges(document, changes, forward) {
  const field = forward ? "after" : "before",
    index = forward ? "newIndex" : "oldIndex";
  for (const change of changes) {
    let parent = document;
    for (const key of change.path.slice(0, -1)) parent = parent[key];
    const key = change.path.at(-1);
    if (!change.records) {
      if (change[field] === undefined) delete parent[key];
      else parent[key] = copy(change[field]);
      continue;
    }
    const list = parent[key];
    const replacements = new Map(
      change.records.map((record) => [record.id, record]),
    );
    const next = list.flatMap((item) => {
      const record = replacements.get(item.id);
      if (!record) return [item];
      replacements.delete(item.id);
      return record[field] === undefined ? [] : [copy(record[field])];
    });
    for (const record of [...replacements.values()].sort(
      (a, b) => a[index] - b[index],
    ))
      if (record[field] !== undefined)
        next.splice(record[index], 0, copy(record[field]));
    if (change.order) {
      const order = new Map(
        change.order[forward ? 1 : 0].map((id, i) => [id, i]),
      );
      next.sort((a, b) => order.get(a.id) - order.get(b.id));
    }
    parent[key] = next;
  }
  return document;
}
