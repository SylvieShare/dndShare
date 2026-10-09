// Blender can remove identical indexed faces when importing an old mounting mesh.
// Compare its unique triangles; every distinct surface must still match exactly.
export function mountingSurface(doc) {
  const nodes = doc
    .getRoot()
    .listNodes()
    .filter((n) => n.getMesh())
    .map((n) => ({
      getWorldMatrix: () => n.getWorldMatrix(),
      getMesh: () => ({
        listPrimitives: () =>
          n
            .getMesh()
            .listPrimitives()
            .filter((p) =>
              p.getMaterial()?.getName().startsWith("Simple insertion pegs"),
            )
            .map((p) => {
              const indices = p.getIndices();
              const unique = [];
              const seen = new Set();
              for (let i = 0; i < indices.getCount(); i += 3) {
                const triangle = [0, 1, 2].map((j) => indices.getScalar(i + j));
                const key = triangle
                  .slice()
                  .sort((a, b) => a - b)
                  .join(",");
                if (seen.has(key)) continue;
                seen.add(key);
                unique.push(...triangle);
              }
              return {
                getAttribute: (s) => p.getAttribute(s),
                getIndices: () => ({
                  getCount: () => unique.length,
                  getScalar: (i) => unique[i],
                }),
              };
            }),
      }),
    }));
  return { getRoot: () => ({ listNodes: () => nodes }) };
}
