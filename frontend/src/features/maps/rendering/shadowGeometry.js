import {
  BufferGeometry,
  Float32BufferAttribute,
  ShapeUtils,
  Vector2,
} from "three";
// A closed prism preserves concave wall outlines without the extrusion/bevel pipeline.
export function shadowPrism(
  polygon,
  bottom,
  top,
  width,
  height,
  offset = [0, 0],
) {
  const contour = polygon.map(
    ([x, z]) =>
      new Vector2(x - width / 2 - offset[0], z - height / 2 - offset[1]),
  );
  const positions = [];
  const vertex = (i, y) => [contour[i].x, y, contour[i].y];
  for (const [a, b, c] of ShapeUtils.triangulateShape(contour, [])) {
    positions.push(
      ...vertex(a, bottom),
      ...vertex(b, bottom),
      ...vertex(c, bottom),
    );
    positions.push(...vertex(c, top), ...vertex(b, top), ...vertex(a, top));
  }
  for (let i = 0; i < contour.length; i++) {
    const j = (i + 1) % contour.length;
    positions.push(
      ...vertex(i, bottom),
      ...vertex(i, top),
      ...vertex(j, top),
      ...vertex(i, bottom),
      ...vertex(j, top),
      ...vertex(j, bottom),
    );
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  return geometry;
}
