import { afterEach, expect, it, vi } from 'vitest'
import { applyDocumentPatches, copyDocument, documentDiff } from '../lib/documentPatch'
import { seedMapDocument, writeMapDocument } from './mapDocuments'
import { fetchPatch } from './http'
vi.mock('./http',()=>({fetchGet:vi.fn(),fetchPatch:vi.fn()}))
vi.mock('@/stores/account',()=>({useAccountStore:()=>({user:{id:907}})}))
afterEach(()=>vi.unstubAllGlobals())
it('bases the next edit on the optimistic map DTO returned after restoring pending mirrors',async()=>{
  const base={name:'Map',document:{tiles:[{id:'tile',mirrored:true}]}}
  const off={name:'Map',document:{tiles:[{id:'tile',mirrored:false}]}}
  let server={name:'Map',document:{tiles:[{id:'tile'}]}},version=2,release
  const packets=[]
  const patches=documentDiff(base,off)
  const saved={base,version:1,queue:[{patches:documentDiff(off,base),metadata:{}}],flight:{packet:{baseVersion:1,mutationId:'accepted',patches},groups:[{patches,metadata:{}}],receipt:{version:2,data:server}}}
  const memory=new Map([['dndshare.document-pending.v1.907:map:restored-mirror',JSON.stringify(saved)]])
  vi.stubGlobal('localStorage',{getItem:key=>memory.get(key),setItem:(key,value)=>memory.set(key,value),removeItem:key=>memory.delete(key)})
  vi.mocked(fetchPatch).mockImplementation(async(_url,packet)=>{
    packets.push(packet)
    if(packets.length===1)await new Promise(resolve=>{release=resolve})
    server=applyDocumentPatches(copyDocument(server),packet.patches)
    return {version:++version,data:server,metadata:{id:'restored-mirror'}}
  })
  const view=seedMapDocument({...server,id:'restored-mirror',revision:2,owned:true})
  expect(view.document.tiles[0].mirrored).toBe(true)
  release();await vi.waitFor(()=>expect(version).toBe(3))
  const next={...view,document:{tiles:[{id:'tile'}]}}
  const result=await writeMapDocument(next)
  expect(result.document.tiles[0]).toEqual({id:'tile'})
  expect(version).toBe(4)
  expect(packets).toHaveLength(2)
})
