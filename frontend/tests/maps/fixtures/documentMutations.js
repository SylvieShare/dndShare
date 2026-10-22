import {applyDocumentPatches, copyDocument, documentDiff} from '../../../src/shared/lib/documentPatch'
export function documentMutationFixture(fields) {
 const receipts=new Map()
 const content=record=>Object.fromEntries(fields.map(field=>[field,record[field]]))
 return (record,packet)=>{
  if(receipts.has(packet.mutationId))return {record,response:receipts.get(packet.mutationId)}
  if(record.revision!==packet.baseVersion)return {status:409,response:{desc:'Карта изменена в другой вкладке'}}
  const before=content(record),next=applyDocumentPatches(copyDocument(before),packet.patches)
  // The real map DTO omits optional false fields when it is marshalled by Go.
  for(const tile of next.document?.tiles || []) if(tile.mirrored===false) delete tile.mirrored
  const saved={...record,...next,revision:record.revision+1,changedAt:new Date().toISOString()}
  const {name,document,state,routes,...metadata}=saved
  const response={fromVersion:record.revision,version:saved.revision,patches:documentDiff(before,next),metadata}
  receipts.set(packet.mutationId,response)
  return {record:saved,response}
 }
}
