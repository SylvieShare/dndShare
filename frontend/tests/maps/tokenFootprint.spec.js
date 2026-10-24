import { test, expect } from "@playwright/test";
import { mapPoint } from "./editorHelpers";

const tokens = page => page.locator(".map-canvas").evaluate(el => el.__vueParentComponent.props.state.tokens);
const saved = page => page.evaluate(() => window.latestBoard.state.tokens);
async function drag(page, row, x, y) {
  const box = await row.boundingBox(), point = await mapPoint(page,x,y);
  await page.mouse.move(box.x+25,box.y+25); await page.mouse.down();
  await page.mouse.move(point.x,point.y,{steps:12});
}

test("Large creature occupies a centred four-cell block and blocked placements cannot change the map", async ({page}) => {
  const errors=[]; page.on("pageerror",e=>errors.push(e.message));
  await page.setViewportSize({width:1440,height:1000});
  await page.goto("/tests/maps/fixtures/maps.html?mode=board&creatures&miniatures&largeCreature&imageMap");
  await expect(page.locator(".map-canvas canvas")).toBeVisible();
  await page.getByRole("button",{name:"Существа",exact:true}).click();
  const roster=page.getByRole("region",{name:"Существа сессии"});
  const ogre=roster.getByRole("button",{name:"A · Огр",exact:true});
  const player=roster.getByRole("button",{name:"Лира",exact:true});
  await drag(page,ogre,6.1,5.1);
  await expect.poll(async()=> (await tokens(page)).find(t=>t.ref==="ogre")).toMatchObject({x:6,y:5,size:2,moving:true,invalidSurface:false});
  expect((await saved(page)).some(t=>t.ref==="ogre")).toBe(false);
  await page.mouse.up();
  await expect.poll(async()=> (await saved(page)).find(t=>t.ref==="ogre")).toMatchObject({x:6,y:5,size:2});
  const original=(await saved(page)).find(t=>t.ref==="ogre");
  expect(original).not.toHaveProperty("moving");
  await drag(page,player,6.5,5.5);
  await expect.poll(async()=> (await tokens(page)).find(t=>t.ref==="41")?.invalidSurface).toBe(true);
  await page.mouse.up();
  expect((await saved(page)).some(t=>t.ref==="41")).toBe(false);
  await drag(page,player,8.5,5.5); await page.mouse.up();
  await expect.poll(async()=> (await saved(page)).find(t=>t.ref==="41")?.x).toBe(8.5);
  const size=page.getByRole("combobox").filter({visible:true});
  await size.selectOption("6");
  await expect(page.getByRole("status")).toHaveText(/заняты/);
  await expect(page.getByRole("combobox").filter({visible:true})).toHaveValue("1");
  expect((await saved(page)).find(t=>t.ref==="41").size).toBe(1);
  await drag(page,ogre,8.1,5.1);
  await expect.poll(async()=> (await tokens(page)).find(t=>t.ref==="ogre")?.invalidSurface).toBe(true);
  await page.mouse.up();
  expect((await saved(page)).find(t=>t.ref==="ogre")).toEqual(original);
  expect((await saved(page)).filter(t=>t.ref==="ogre")).toHaveLength(1);
  expect(errors).toEqual([]);
});
