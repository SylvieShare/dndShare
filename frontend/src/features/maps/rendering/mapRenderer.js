import { WebGLRenderer, Assets, Container, Graphics, Sprite } from 'pixi.js';
import { TERRAINS, visibilityAt } from '../lib/mapModel';
import { terrainTexture } from './textures';
import { buildTerrain, buildGrid, backgroundSprite, CELL } from './terrain';
import { drawObject, drawToken } from './objects';
import { fogLayer, zoneLayer } from './fog';

export async function createMapRenderer(host, onError) {
  const gpu = new WebGLRenderer();
  await gpu.init({
    antialias: true,
    autoDensity: true,
    resolution: Math.min(devicePixelRatio || 1, 2),
    background: 0x161b23,
  });
  const stage = new Container();
  const app = {
    stage,
    canvas: gpu.canvas,
    renderer: gpu,
    render: () => gpu.render({ container: stage }),
    destroy: () => {
      stage.destroy({ children: true });
      gpu.destroy(true);
    },
  };
  host.appendChild(app.canvas);
  const board = new Container(),
    layers = {},
    keys = {};
  app.stage.addChild(board);
  const textures = Object.fromEntries(TERRAINS.map((t) => [t.id, terrainTexture(t.id)]));
  let current,
    view = { x: 15, y: 11, cellPixels: 40, rotation: 0, fit: true },
    dead = false;
  const order = ['terrain', 'background', 'objects', 'grid', 'tokens', 'fog', 'zones', 'selection'];
  for (const name of order) {
    layers[name] = new Container();
    board.addChild(layers[name]);
  }
  function replace(name, child) {
    if (dead) {
      child.destroy({ children: true });
      return;
    }
    const old = layers[name];
    board.addChildAt(child, board.getChildIndex(old));
    board.removeChild(old);
    old.destroy({ children: true });
    layers[name] = child;
  }
  function render() {
    if (!dead) app.render();
  }
  function camera(next = view) {
    view = { ...next };
    const w = host.clientWidth || 1,
      h = host.clientHeight || 1,
      d = current;
    app.renderer.resize(w, h);
    let pixels = view.cellPixels;
    if (d && view.fit) {
      const swap = view.rotation % 180 !== 0;
      pixels = Math.min(
        (w - 24) / (swap ? d.height : d.width),
        (h - 24) / (swap ? d.width : d.height),
      );
      view.x = d.width / 2;
      view.y = d.height / 2;
    }
    board.pivot.set(view.x * CELL, view.y * CELL);
    board.position.set(w / 2, h / 2);
    board.scale.set(Math.max(0.01, pixels / CELL));
    board.rotation = (view.rotation * Math.PI) / 180;
    render();
  }
  async function update(d, state, opts = {}) {
    current = d;
    const terrainKey = JSON.stringify([d.kind, d.width, d.height, d.base, d.cells]);
    if (keys.terrain !== terrainKey) {
      keys.terrain = terrainKey;
      replace('terrain', buildTerrain(d, textures));
    }
    const bgKey = JSON.stringify([d.kind, d.background.url, d.width, d.height]);
    if (keys.background !== bgKey) {
      keys.background = bgKey;
      replace('background', new Container());
      if (d.kind !== 'tiles' && d.background.url) {
        Assets.load(d.background.url)
          .then((texture) => {
            if (!dead && keys.background === bgKey) {
              const layer = new Container();
              layer.addChild(backgroundSprite(texture, d));
              replace('background', layer);
              render();
            }
          })
          .catch(() => onError?.('Не удалось загрузить фон карты'));
      }
    }
    const objectKey = JSON.stringify([d.objects, state?.objects]);
    if (keys.objects !== objectKey) {
      keys.objects = objectKey;
      const layer = new Container();
      for (const o of d.objects) layer.addChild(drawObject(o, state?.objects?.[o.id] ?? o.open));
      replace('objects', layer);
    }
    const gridKey = JSON.stringify([d.width, d.height, d.kind, d.grid]);
    if (keys.grid !== gridKey) {
      keys.grid = gridKey;
      replace('grid', buildGrid(d));
    }
    const tokenKey = JSON.stringify([
      state?.tokens,
      opts.master,
      state?.fog,
      state?.zones,
      state?.defaultVisibility,
    ]);
    if (keys.tokens !== tokenKey) {
      keys.tokens = tokenKey;
      const layer = new Container();
      for (const token of state?.tokens || []) {
        if (
          !opts.master &&
          (token.hidden || token.physical || visibilityAt(d, state, token.x, token.y) !== 'visible')
        )
          continue;
        const root = drawToken(token, opts.master);
        layer.addChild(root);
        if (token.imageUrl)
          Assets.load(token.imageUrl)
            .then((texture) => {
              if (dead || root.destroyed) return;
              const r = (token.size * CELL) / 2 - 7,
                avatar = new Sprite(texture),
                scale = Math.max((2 * r) / texture.width, (2 * r) / texture.height);
              avatar.anchor.set(0.5);
              avatar.scale.set(scale);
              const mask = new Graphics().circle(0, 0, r).fill(0xffffff);
              avatar.mask = mask;
              root.addChildAt(avatar, 2);
              root.addChild(mask);
              render();
            })
            .catch(() => {});
      }
      replace('tokens', layer);
    }
    const fogKey = JSON.stringify([
      d.width,
      d.height,
      d.grid,
      d.zones,
      state?.fog,
      state?.zones,
      state?.defaultVisibility,
      opts.master,
    ]);
    if (keys.fog !== fogKey) {
      keys.fog = fogKey;
      replace('fog', fogLayer(d, state, opts.master));
    }
    replace(
      'zones',
      opts.master ? zoneLayer(d, opts.selectedZone, opts.showZones) : new Container(),
    );
    const selection = new Graphics();
    if (opts.selection) {
      const r = opts.selection;
      selection
        .rect(r.x * CELL, r.y * CELL, r.width * CELL, r.height * CELL)
        .fill({ color: 0xc1adf1, alpha: 0.15 })
        .stroke({ color: 0xd9c8ff, width: 2 });
    }
    const selected =
      state?.tokens?.find((t) => t.id === opts.selectedToken) ||
      d.objects.find((o) => o.id === opts.selectedObject);
    if (selected && opts.master)
      selection
        .circle(
          selected.x * CELL,
          selected.y * CELL,
          ((selected.size || selected.scale || 1) * CELL) / 2 + 6,
        )
        .stroke({ color: 0xf2d397, width: 3 });
    replace('selection', selection);
    camera();
  }
  const observer = new ResizeObserver(() => camera());
  observer.observe(host);
  return {
    update,
    camera,
    getView: () => ({ ...view, cellPixels: board.scale.x * CELL }),
    world(event) {
      const r = app.canvas.getBoundingClientRect();
      const p = board.toLocal({ x: event.clientX - r.left, y: event.clientY - r.top });
      return { x: p.x / CELL, y: p.y / CELL };
    },
    destroy() {
      dead = true;
      observer.disconnect();
      app.destroy(true, { children: true });
      Object.values(textures).forEach((t) => t.destroy(true));
    },
  };
}
