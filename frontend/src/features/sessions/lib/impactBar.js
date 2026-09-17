export function impactBar(impact) {
  const before = Math.max(0, Number(impact.before?.current) || 0)
  const after = Math.max(0, Number(impact.after?.current) || 0)
  const max = Math.max(0, Number(impact.before?.max) || 0, Number(impact.after?.max) || 0, before, after)
  const lost = Math.max(0, before - after)
  const pct = value => max ? Math.max(0, Math.min(100, value / max * 100)) : 0
  return { max, lost, remaining: pct(after), lossStart: pct(after), lossWidth: pct(lost), labelCenter: pct(after + lost / 2) }
}
