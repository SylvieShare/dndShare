// Only COLOR_0 is consumed by the standard glTF material in these baked models.
export function stripAuxiliaryColours(doc) {
  let removed = 0;
  for (const mesh of doc.getRoot().listMeshes())
    for (const primitive of mesh.listPrimitives())
      for (const semantic of primitive.listSemantics())
        if (/^COLOR_[1-9]\d*$/.test(semantic)) {
          primitive.setAttribute(semantic, null);
          removed++;
        }
  return removed;
}
