import { CanvasTexture, CircleGeometry, Mesh, MeshBasicMaterial, SRGBColorSpace } from 'three';

// Draw a consistent skull and crossbones without depending on an emoji font.
export function deadTokenMark(token, fog) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const c = canvas.getContext('2d');
  c.strokeStyle = c.fillStyle = '#fff9eb';
  c.shadowColor = '#17191f';
  c.shadowBlur = 8;
  c.lineWidth = 19;
  c.lineCap = 'round';
  for (const [x1, y1, x2, y2] of [[48, 183, 208, 55], [48, 55, 208, 183]]) {
    c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke();
    for (const [x, y] of [[x1, y1], [x2, y2]]) {
      for (const dy of [-7, 7]) { c.beginPath(); c.arc(x, y + dy, 10, 0, Math.PI * 2); c.fill(); }
    }
  }
  c.beginPath(); c.ellipse(128, 101, 57, 59, 0, 0, Math.PI * 2); c.fill();
  c.fillRect(94, 128, 68, 40);
  c.shadowBlur = 0;
  c.fillStyle = '#17191f';
  for (const x of [106, 150]) { c.beginPath(); c.ellipse(x, 103, 14, 17, 0, 0, Math.PI * 2); c.fill(); }
  c.beginPath(); c.moveTo(128, 120); c.lineTo(118, 137); c.lineTo(138, 137); c.closePath(); c.fill();
  for (const x of [110, 125, 140]) c.fillRect(x, 151, 5, 17);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  const mark = new Mesh(new CircleGeometry(token.size * .38, 48), fog.material(new MeshBasicMaterial({
    map: texture, transparent: true, opacity: .62 * (token.hidden ? .4 : 1), depthWrite: false, toneMapped: false,
  })));
  mark.rotation.x = -Math.PI / 2;
  mark.position.y = -.022;
  mark.userData.deadTokenMark = true;
  return mark;
}
