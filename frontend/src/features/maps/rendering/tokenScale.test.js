import { expect, it } from "vitest";
import { BoxGeometry, Matrix4, Vector3 } from "three";
import { tokenBodyScale } from "./tokenScale";
it("keeps native transformed parts inside a central radius and always reduces the nominal model", () => {
  const geometry = new BoxGeometry(.4,1,.3);
  const part = { geometry, matrix: new Matrix4().makeTranslation(1.1,.5,.2) };
  const scale = tokenBodyScale(2,{parts:[part]});
  expect(scale).toBeLessThanOrEqual(1.4);
  const attribute = geometry.attributes.position;
  const p = new Vector3();
  for (let i=0;i<attribute.count;i++) {
    p.fromBufferAttribute(attribute,i).applyMatrix4(part.matrix).multiplyScalar(scale);
    expect(Math.hypot(p.x,p.z)).toBeLessThanOrEqual(.700001);
  }
  expect(part.matrix.elements[12]).toBe(1.1);
  geometry.dispose();
});
