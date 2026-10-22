// Select an upper connected sculpt component without altering source coordinates.
export function selectSourceComponent(positions, aboveMM, componentIndex = 0, boundsMM) {
  if (!Number.isFinite(aboveMM) || !Number.isInteger(componentIndex) || componentIndex < 0)
    throw new Error('Finite component height and nonnegative integer rank required');
  if (positions.length % 9) throw new Error('Unindexed source triangles required');
  if (boundsMM && (!Array.isArray(boundsMM.minMM) || !Array.isArray(boundsMM.maxMM) || boundsMM.minMM.length!==3 || boundsMM.maxMM.length!==3 || !boundsMM.minMM.every((v,i)=>Number.isFinite(v)&&Number.isFinite(boundsMM.maxMM[i])&&v<boundsMM.maxMM[i]))) throw new Error('Finite component bounds required');
  const ids = new Int32Array(positions.length / 3).fill(-1);
  const unique = new Map(), parent = [];
  function find(i) {
    while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; }
    return i;
  }
  for (let i = 0; i < ids.length; i++) {
    const offset = i * 3;
    if (positions[offset + 2] <= aboveMM) continue;
    if (boundsMM && [0,1,2].some(a=>positions[offset+a]<boundsMM.minMM[a]||positions[offset+a]>boundsMM.maxMM[a])) continue;
    const key = `${positions[offset]},${positions[offset + 1]},${positions[offset + 2]}`;
    let id = unique.get(key);
    if (id === undefined) {
      id = parent.length; parent.push(id); unique.set(key, id);
    }
    ids[i] = id;
  }
  for (let i = 0; i < ids.length; i += 3) for (let j = 0; j < 3; j++) {
    const a = ids[i + j], b = ids[i + (j + 1) % 3];
    if (a >= 0 && b >= 0) parent[find(a)] = find(b);
  }
  const counts = new Map();
  for (let i = 0; i < parent.length; i++) {
    const root = find(i); counts.set(root, (counts.get(root) || 0) + 1);
  }
  const components = [...counts].sort((a, b) => b[1] - a[1] || a[0] - b[0]);
  if (!components[componentIndex]) throw new Error('Requested source component does not exist');
  const selectedRoot = components[componentIndex][0], selected = [];
  for (let i = 0; i < ids.length; i += 3) {
    // The height selects the component; it must not cut long source faces.
    if (![0, 1, 2].some(j => ids[i + j] >= 0 && find(ids[i + j]) === selectedRoot)) continue;
    for (let j = 0; j < 9; j++) selected.push(positions[i * 3 + j]);
  }
  if (!selected.length) throw new Error('Selected component has no source triangles');
  return { positions: Float32Array.from(selected), components: components.length,
    counts: components.map(([, count]) => count), vertices: components[componentIndex][1],
    triangles: selected.length / 9 };
}
