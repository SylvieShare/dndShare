import { test, expect } from '@playwright/test'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

test('reflected normal-map lighting matches baked geometry, including preview and real shadows', async ({
  page,
}) => {
  await page.goto('/tests/maps/fixtures/mirrorShading.html')
  await page.waitForFunction(() => window.mirrorShading)
  const compare = (options) =>
    page.evaluate((options) => window.mirrorShading.compare(options), options)
  expect((await compare({ legacy: true, normalMap: false })).mean).toBeLessThan(
    0.1,
  )
  expect((await compare({ legacy: true })).mean).toBeGreaterThan(3)
  for (const rotation of [0, 90])
    for (const preview of [false, true]) {
      const result = await compare({ rotation, preview })
      expect(result.mean).toBeLessThan(0.1)
    }
  expect((await compare({ shadows: true })).mean).toBeLessThan(0.1)
})

for (const tier of ['render', 'lod'])
  test(`local Medieval wooden floor ${tier} matches baked reflection under the same light`, { tag: "@local-model" }, async ({
    page,
  }) => {
    const filename = resolve(
      `../models/collections/medieval-town-vol1/review/MT1-014/${tier}.glb`,
    )
    test.skip(!existsSync(filename), 'optional local model diagnostic')
    await page.route('**/diagnostic-wood.glb', (route) =>
      route.fulfill({
        contentType: 'model/gltf-binary',
        body: readFileSync(filename),
      }),
    )
    await page.route('**/diagnostic-wood-shadow.glb', (route) =>
      route.fulfill({
        contentType: 'model/gltf-binary',
        body: readFileSync(
          resolve(
            '../models/collections/medieval-town-vol1/review/MT1-014/shadow.glb',
          ),
        ),
      }),
    )
    await page.goto('/tests/maps/fixtures/mirrorShading.html')
    await page.waitForFunction(() => window.mirrorShading)
    const compare = (options) =>
      page.evaluate(
        (options) =>
          window.mirrorShading.compare({
            url: '/diagnostic-wood.glb',
            metadata: { width: 1, height: 1, mountDepth: 0.153517 },
            ...options,
          }),
        options,
      )
    const original = await compare({ legacy: true }),
      corrected = await compare({})
    console.log('Wood reflection GPU difference', { original, corrected })
    expect(original.mean).toBeGreaterThan(0.1)
    expect(corrected.mean).toBeLessThan(0.15)
    expect(corrected.mean).toBeLessThan(original.mean * 0.05)
    expect(
      (
        await compare({
          shadows: true,
          shadowURL: '/diagnostic-wood-shadow.glb',
        })
      ).mean,
    ).toBeLessThan(0.15)
  })
