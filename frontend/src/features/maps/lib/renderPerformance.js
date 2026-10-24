export const CPU_PARTS = [
  ["tiles", "Плитки", "var(--accent)"],
  ["objects", "Объекты и жетоны", "var(--info)"],
  ["lighting", "Освещение", "var(--warning)"],
  ["decals", "Декали", "var(--accent-soft)"],
  ["effects", "Огонь", "var(--danger)"],
  ["fog", "Туман", "var(--accent-soft)"],
  ["areas", "Области", "var(--success)"],
  ["draw", "Отправка в GPU", "var(--info)"],
  ["overlays", "Обводка", "var(--success)"],
  ["previews", "Превью", "var(--warning)"],
  ["other", "Прочее", "var(--text-muted)"],
].map(([id, label, color]) => ({ id, label, color }));
export const GPU_PARTS = [
  ["frame", "Кадр целиком", "var(--accent)"],
  ["tiles", "Плитки со светом", "var(--accent)"],
  ["objects", "Объекты и жетоны", "var(--info)"],
  ["shadows", "Тени освещения", "var(--text-muted)"],
  ["decals", "Декали", "var(--accent-soft)"],
  ["effects", "Огонь", "var(--warning)"],
  ["fog", "Туман", "var(--accent-soft)"],
  ["outline", "Обводка", "var(--success)"],
  ["overlays", "Метки и подсказки", "var(--info)"],
  ["presentation", "Вывод кадра", "var(--text-muted)"],
  ["other", "Прочее", "var(--border-strong)"],
].map(([id, label, color]) => ({ id, label, color }));
export const totalMs = (parts) =>
  parts ? Object.values(parts).reduce((a, b) => a + b, 0) : null;
const timeFormat = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 });
export const ms = (value) =>
  value == null ? "—" : timeFormat.format(value) + " мс";

export function performanceChart(history, metric, parts) {
  const max =
      Math.max(16.7, ...history.map((b) => totalMs(b[metric]) || 0)) * 1.1,
    paths = Object.fromEntries(parts.map((p) => [p.id, ""])),
    columns = [];
  history.forEach((bin, i) => {
    const values = bin[metric];
    if (!values) return;
    let y = 112;
    const x = 24 + i * 4.5;
    for (const part of parts) {
      const h = ((values[part.id] || 0) / max) * 104;
      if (h > 0) {
        paths[part.id] += `M${x},${y}h4v${-h}h-4Z`;
        y -= h;
      }
    }
    columns.push({
      x,
      title:
        `${Math.round((history.at(-1).at - bin.at) / 1000)} с назад · ${ms(totalMs(values))}\n` +
        parts
          .filter((p) => values[p.id] > 0)
          .map((p) => `${p.label}: ${ms(values[p.id])}`)
          .join("\n"),
    });
  });
  return { max, paths, columns, budgetY: 112 - (16.7 / max) * 104 };
}
