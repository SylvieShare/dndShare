import assert from "node:assert/strict";
import { nativeFrameCellCentre } from "./native_seat_support.mjs";

export function receiverCells(model) {
  assert.ok(Number.isInteger(model.width) && model.width > 0);
  assert.ok(Number.isInteger(model.height) && model.height > 0);
  assert.ok(model.supportSlots?.length, "Receiving slots required");
  const cells = new Map();
  for (const slot of model.supportSlots) {
    assert.ok([slot.x, slot.y, slot.width, slot.height].every(Number.isInteger));
    assert.ok(slot.x >= 0 && slot.y >= 0 && slot.width > 0 && slot.height > 0);
    assert.ok(slot.x + slot.width <= model.width && slot.y + slot.height <= model.height);
    for (let y = slot.y; y < slot.y + slot.height; y++)
      for (let x = slot.x; x < slot.x + slot.width; x++) {
        const key = `${x},${y}`;
        assert.ok(!cells.has(key), "Overlapping receiving slots");
        cells.set(key, { x, y, centerMM: nativeFrameCellCentre(model.width, model.height, x, y), seatsMM: {} });
      }
  }
  return [...cells.values()].sort((a, b) => a.y - b.y || a.x - b.x);
}

export function receiverSlotForCell(model, x, y) {
  const slots = model.supportSlots.filter(s => x >= s.x && x < s.x + s.width && y >= s.y && y < s.y + s.height);
  assert.equal(slots.length, 1, "Each receiving cell needs exactly one support slot");
  return slots[0];
}

export function socketProbeCellSamples(probes, cells) {
  const counts = Object.fromEntries(cells.map(c => [`${c.x},${c.y}`, 0]));
  for (const probe of probes) {
    const key = `${probe.cell?.x},${probe.cell?.y}`;
    assert.ok(Object.hasOwn(counts, key), "Socket probe belongs to an unmeasured cell");
    counts[key]++;
  }
  assert.ok(Object.values(counts).every(n => n >= 100), "Every receiving cell needs socket probes");
  return counts;
}
