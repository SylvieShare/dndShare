import { expect, it, vi } from 'vitest'
import { experiencePlan, saveExperiencePlan } from './rosterExperience'
it('retries only failed characters and keeps the original experience grant',async()=>{
  const a={charUuid:'a',version:1,data:{values:{lvl:{exp:10}}}},b={charUuid:'b',version:1,data:{values:{lvl:{exp:30}}}}
  const plan=experiencePlan([a,b].map(participant=>({participant,path:'values.lvl.exp'})),100)
  const persist=vi.fn(async(uuid,updates)=>{if(uuid==='b')throw Error('unavailable');return {version:2,data:{values:{lvl:{exp:updates[0].value}}}}})
  await expect(saveExperiencePlan(plan,persist)).rejects.toThrow('1')
  expect(a.data.values.lvl.exp).toBe(110)
  expect(b.data.values.lvl.exp).toBe(30)
  persist.mockImplementation(async(uuid,updates)=>({version:2,data:{values:{lvl:{exp:updates[0].value}}}}))
  await saveExperiencePlan(plan,persist)
  expect(persist.mock.calls.map(row=>row[0])).toEqual(['a','b','b'])
  expect(b.data.values.lvl.exp).toBe(130)
})
