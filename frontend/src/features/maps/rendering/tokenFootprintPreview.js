import { BufferGeometry, Float32BufferAttribute, Group, LineBasicMaterial, LineSegments } from "three";
import { tokenBounds, occupiesCells } from "../lib/tokenFootprint";

export function createTokenFootprintPreview() {
  const root = new Group(), material = new LineBasicMaterial({ color: 0x63d695, depthTest: false, transparent: true, opacity: .8 });
  let geometry, key = "";
  return {
    root,
    update(tokens, master) {
      const token = master && tokens.find(t => t.moving && occupiesCells(t));
      root.visible = !!token;
      if (!token) return;
      const bounds = tokenBounds(token), elevation = (token.elevation ?? .44) + .015;
      const next = JSON.stringify([bounds, elevation, token.invalidSurface]);
      if (next === key) return;
      key = next;
      geometry?.dispose(); root.clear();
      const points = [];
      for (let y = bounds.y; y < bounds.y+bounds.height; y++)
        for (let x = bounds.x; x < bounds.x+bounds.width; x++) {
          const corners = [[x+.025,y+.025],[x+.975,y+.025],[x+.975,y+.975],[x+.025,y+.975]];
          corners.forEach((p,i) => { const q=corners[(i+1)%4]; points.push(p[0],elevation,p[1],q[0],elevation,q[1]); });
        }
      geometry = new BufferGeometry(); geometry.setAttribute("position",new Float32BufferAttribute(points,3));
      material.color.setHex(token.invalidSurface ? 0xf07878 : 0x63d695);
      const lines = new LineSegments(geometry,material);
      lines.raycast = () => {}; lines.renderOrder = 11;
      root.add(lines);
    },
    destroy() { geometry?.dispose(); material.dispose(); root.clear(); },
  };
}
