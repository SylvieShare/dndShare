import { test, expect } from '@playwright/test'

test('two tabs retain separate queues; reload recovers only the closed owner and acknowledgements remain isolated', async ({ page: a, context }) => {
  const b = await context.newPage()
  const open = async page => {
    page.on('pageerror', error => { throw error })
    await page.goto('/tests/document-sync/fixture.html')
    await page.waitForFunction(() => window.loaded)
    await page.evaluate(() => window.start())
  }
  await open(a)
  await open(b)
  await a.evaluate(() => { window.editor.edit({ a: 1, b: 0 }); void window.editor.flush() })
  await expect.poll(() => a.evaluate(() => window.packets.length)).toBe(1)
  await b.evaluate(() => window.editor.edit({ a: 0, b: 1 }))
  await a.evaluate(() => window.ack({ version: 2, patches: window.packets[0].patches }))
  await a.evaluate(() => window.editor.whenIdle())
  expect(await b.evaluate(() => Object.keys(localStorage).filter(key => key.startsWith('test.multi-tab.document:queue:')).length)).toBe(1)

  const other = await context.newPage()
  await open(other)
  expect(await other.evaluate(() => window.editor.pending)).toBe(false)
  await other.close()

  await b.reload()
  await b.waitForFunction(() => window.loaded)
  await b.evaluate(() => window.start({ a: 1, b: 0 }, 2))
  expect(await b.evaluate(() => window.editor.data)).toEqual({ a: 1, b: 1 })
  await b.evaluate(() => { void window.editor.flush() })
  await expect.poll(() => b.evaluate(() => window.packets.length)).toBe(1)
  await b.evaluate(() => window.ack({ version: 3, patches: window.packets[0].patches }))
  await b.evaluate(() => window.editor.whenIdle())
  expect(await b.evaluate(() => Object.keys(localStorage).filter(key => key.startsWith('test.multi-tab.document:queue:')).length)).toBe(0)
})
