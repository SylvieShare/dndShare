import { expect, test } from '@playwright/test'

for (const mobile of [false,true]) for (const role of ['dm','player']) {
  test(`session icon navigation retains role boundaries and one moving square ${role} ${mobile}`, async ({page}) => {
    const errors=[];page.on('pageerror',e=>errors.push(e.message))
    await page.setViewportSize(mobile?{width:390,height:844}:{width:1440,height:1000})
    await page.goto(`/tests/tutorials/fixtures/navigation.html?role=${role}`)
    const nav=page.getByRole('navigation',{name:'Раздел сессии'})
    const story=nav.getByRole('button',{name:'Сюжет',exact:true})
    await expect(story).toHaveAttribute('aria-current','page')
    const caption=await story.evaluate(node=>{
      const icon=node.querySelector('svg').getBoundingClientRect(),label=node.querySelector('.share-icon-navigation__label').getBoundingClientRect()
      return label.y>=icon.bottom
    })
    expect(caption).toBe(true)
    await expect(nav.getByRole('separator')).toHaveCount(role==='dm'?2:0)
    await expect(nav.getByRole('button',{name:'Настройки',exact:true})).toHaveCount(role==='dm'?1:0)
    await story.focus();await page.keyboard.press('ArrowRight')
    const combat=nav.getByRole('button',{name:'Открыть бой · бой идёт',exact:true})
    await expect(combat).toBeFocused()
    await expect(story).toHaveAttribute('aria-current','page')
    await page.keyboard.press('Enter')
    await expect(nav.getByRole('button',{name:'Бой открыт · бой идёт',exact:true})).toHaveAttribute('aria-current','page')
    await expect(nav.locator('.share-icon-navigation__indicator')).toHaveCount(1)
    await expect.poll(()=>nav.evaluate(node=>{
      const square=node.querySelector('.share-icon-navigation__indicator').getBoundingClientRect(),active=node.querySelector('[aria-current="page"]').getBoundingClientRect()
      return Math.max(Math.abs(square.x-active.x),Math.abs(square.y-active.y),Math.abs(square.width-square.height))
    })).toBeLessThan(1)
    if (role==='dm') {
      await nav.getByRole('button',{name:'Хроника',exact:true}).click()
      await expect(page.locator('[data-view="events"]')).toBeVisible()
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(mobile ? 390 : 1440)
    expect(errors).toEqual([])
  })
}
