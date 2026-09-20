import { describe, expect, it } from 'vitest';
import {
  flood,
  lineCells,
  newMap,
  paint,
  resized,
  snap,
  visibilityAt,
  initialState,
  rectangle,
} from './mapModel';

describe('map geometry and fog', () => {
  it('aligns rectangular zones to the calibrated image grid', () => {
    const d = newMap('image-grid').document;
    d.grid.offsetX = 0.5;
    expect(rectangle(d, { x: 1.6, y: 1.1 }, { x: 2.6, y: 2.1 })).toEqual({
      x: 1.5,
      y: 1,
      width: 2,
      height: 2,
    });
    expect(rectangle(d, { x: 0.1, y: 0.1 }, { x: 0.2, y: 0.2 }).x).toBe(0);
  });
  it('fills a bounded room without crossing its walls', () => {
    const d = newMap().document;
    d.width = d.height = 6;
    paint(d, lineCells({ x: 3, y: 0 }, { x: 3, y: 5 }), 'wall-stone');
    flood(d, { x: 1, y: 1 }, 'wood');
    expect(d.cells['2,4']).toBe('wood');
    expect(d.cells['3,4']).toBe('wall-stone');
    expect(d.cells['4,4']).toBeUndefined();
  });
  it('remaps cell zones when resizing and clips objects and rectangles', () => {
    const d = newMap().document;
    d.width = 8;
    d.height = 8;
    d.zones = [{ id: 'z', cells: [9, 63], rects: [{ x: 2, y: 2, width: 6, height: 6 }] }];
    d.objects = [
      { x: 7, y: 7 },
      { x: 2, y: 2 },
    ];
    const next = resized(d, 4, 4);
    expect(next.zones[0].cells).toEqual([5]);
    expect(next.zones[0].rects[0]).toEqual({ x: 2, y: 2, width: 2, height: 2 });
    expect(next.objects).toHaveLength(1);
    expect(d.zones[0].cells).toEqual([9, 63]);
  });
  it('shares the reveal union semantics for rectangles and cells', () => {
    const d = newMap().document,
      s = initialState();
    d.zones = [
      { id: 'room', rects: [{ x: 0, y: 0, width: 8, height: 8 }] },
      { id: 'opening', cells: [31] },
    ];
    s.zones = { room: 'explored', opening: 'visible' };
    expect(visibilityAt(d, s, 1.5, 1.5)).toBe('visible');
    expect(visibilityAt(d, s, 3, 3)).toBe('explored');
    expect(visibilityAt(d, s, 15, 15)).toBe('hidden');
    s.fog = false;
    expect(visibilityAt(d, s, 15, 15)).toBe('visible');
  });
  it('snaps large creatures to the grid without moving outside the board', () => {
    const d = newMap().document;
    expect(snap(d, { x: 2.8, y: 3.1 }, 2)).toEqual({ x: 3, y: 3 });
    expect(snap(d, { x: 0, y: 100 }, 2)).toEqual({ x: 1, y: 21 });
    d.width = d.height = 2;
    expect(snap(d, { x: 0, y: 100 }, 8)).toEqual({ x: 1, y: 1 });
  });
  it('does not wrap negative offset-grid columns into the previous row', () => {
    const d = newMap().document,
      s = initialState();
    d.grid.offsetX = 0.5;
    d.zones = [{ id: 'last', cells: [29] }];
    s.zones.last = 'visible';
    expect(visibilityAt(d, s, 0.1, 1.1)).toBe('hidden');
  });
});
