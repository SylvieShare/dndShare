import { afterEach, expect, it, vi } from "vitest";
import { createTokenMotion } from "./tokenMotion";
afterEach(() => vi.unstubAllGlobals());
it("lifts a picked creature and follows targets continuously, then lands or returns on cancellation", () => {
  const motion = createTokenMotion();
  const origin = { x:1,y:2,elevation:.45 };
  motion.begin(); motion.pose("a",origin,false,16);
  motion.begin();
  const lifted = motion.pose("a",origin,true,16);
  expect(lifted.elevation).toBeGreaterThan(.45); expect(lifted.elevation).toBeLessThan(.67);
  motion.begin();
  const intermediate = motion.pose("a",{...origin,x:5},true,16);
  expect(intermediate.x).toBeGreaterThan(1); expect(intermediate.x).toBeLessThan(5);
  motion.begin();
  const returning = motion.pose("a",origin,false,16);
  expect(returning.x).toBeLessThan(intermediate.x);
  for (let i=0;i<60;i++) { motion.begin(); motion.pose("a",origin,false,16); }
  expect(motion.isMoving()).toBe(false);
  expect(motion.pose("a",origin,false,16)).toMatchObject(origin);
});
it("honours reduced motion while keeping the lift and durable target distinct", () => {
  vi.stubGlobal("matchMedia",()=>({matches:true}));
  const motion = createTokenMotion();
  motion.begin(); motion.pose("a",{x:0,y:0,elevation:.45},false,16);
  motion.begin();
  expect(motion.pose("a",{x:4,y:2,elevation:.45},true,16)).toMatchObject({x:4,y:2,elevation:.67});
  motion.begin();
  expect(motion.pose("a",{x:4,y:2,elevation:.45},false,16).elevation).toBe(.45);
});
