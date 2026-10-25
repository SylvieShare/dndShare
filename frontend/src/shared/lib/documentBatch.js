export function takeDocumentBatch(queue, version) {
  const groups = []
  let operations = 0,
    events = 0
  while (queue.length) {
    const candidate = queue[0],
      count = candidate.metadata.events?.length || 0
    if (
      groups.length &&
      (groups.length >= 1000 || operations + candidate.patches.length > 10000 || events + count > 50)
    )
      break
    groups.push(queue.shift())
    operations += candidate.patches.length
    events += count
  }
  return {
    groups,
    packet: {
      baseVersion: version,
      mutationId: crypto.randomUUID(),
      patches: groups.flatMap((group) => group.patches),
      metadata: groups.map((group) => group.metadata),
    },
  }
}
