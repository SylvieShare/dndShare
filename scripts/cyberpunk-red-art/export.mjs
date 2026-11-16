// Technical export only: the original artwork comes from built-in image_gen.
import fs from 'node:fs/promises'
import path from 'node:path'
import crypto from 'node:crypto'
import {createRequire} from 'node:module'
const [manifestPath,sharpRoot]=process.argv.slice(2)
if(!manifestPath||!sharpRoot)throw new Error('Usage: node export.mjs manifest.json directory-with-sharp')
const sharp=createRequire(path.resolve(sharpRoot,'package.json'))('sharp')
const batch=JSON.parse(await fs.readFile(manifestPath,'utf8'))
const hash=buffer=>crypto.createHash('sha256').update(buffer).digest('hex')
const transparent={r:0,g:0,b:0,alpha:0}

for(const asset of batch.assets){
 const source=path.join(batch.assetRoot,asset.original),destination=path.join(batch.assetRoot,asset.final)
 const bytes=await fs.readFile(source),metadata=await sharp(bytes).metadata()
 await fs.mkdir(path.dirname(destination),{recursive:true})
 asset.originalSha256=hash(bytes)
 asset.sourceDimensions={width:metadata.width,height:metadata.height}
 if(asset.slot==='icon'){
  const {data,info}=await sharp(bytes).ensureAlpha().raw().toBuffer({resolveWithObject:true})
  let left=info.width,top=info.height,right=0,bottom=0,empty=0
  for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++){
   const alpha=data[(y*info.width+x)*4+3]
   if(alpha<8){empty++;continue}
   left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x);bottom=Math.max(bottom,y)
  }
  if(empty<info.width*info.height*.05||left>right)throw new Error('Icon needs genuine alpha: '+asset.key)
  const inset=Math.round(asset.width*.0625)
  const foreground=await sharp(bytes).extract({left,top,width:right-left+1,height:bottom-top+1})
   .resize(asset.width-inset*2,asset.height-inset*2,{fit:'inside',kernel:'lanczos3'}).png().toBuffer()
  const fg=await sharp(foreground).metadata()
  await sharp({create:{width:asset.width,height:asset.height,channels:4,background:transparent}})
   .composite([{input:foreground,left:Math.floor((asset.width-fg.width)/2),top:Math.floor((asset.height-fg.height)/2)}])
   .webp({lossless:true,effort:6}).toFile(destination)
  asset.exportRecipe='Alpha bounds, 6.25% safe margin, Lanczos3 contain, lossless RGBA WebP'
 }else{
  const pipeline=sharp(bytes).resize(asset.width,asset.height,{fit:'cover',position:'centre',kernel:'lanczos3'}).flatten({background:'#20202a'})
  if(destination.endsWith('.webp'))await pipeline.webp({quality:88,effort:6}).toFile(destination)
  else await pipeline.jpeg({quality:88,mozjpeg:true}).toFile(destination)
  asset.exportRecipe='Centered aspect crop, Lanczos3 resize, opaque quality 88 export; crop requires visual review'
 }
 const exported=await fs.readFile(destination),result=await sharp(exported).metadata()
 asset.sha256=hash(exported);asset.bytes=exported.length
 asset.mimeType=destination.endsWith('.jpg')?'image/jpeg':'image/webp'
 asset.exportedDimensions={width:result.width,height:result.height,alpha:!!result.hasAlpha}
 asset.status='exported'
 console.log(asset.key,result.width+'x'+result.height,exported.length,'bytes')
}

const icons=batch.assets.filter(a=>a.slot==='icon'),columns=Math.min(4,icons.length),width=256*columns,height=280*Math.ceil(icons.length/columns)
const backgrounds=`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">${icons.map((a,i)=>`<rect x="${(i%columns)*256}" y="${Math.floor(i/columns)*280}" width="128" height="280" fill="#202024"/><rect x="${(i%columns)*256+128}" y="${Math.floor(i/columns)*280}" width="128" height="280" fill="#eeeeed"/><text x="${(i%columns)*256+8}" y="${Math.floor(i/columns)*280+265}" fill="#acacbd" font-family="Arial" font-size="12">${a.key}</text>`).join('')}</svg>`
const overlays=[]
for(const [i,a]of icons.entries()){
 const raw=await fs.readFile(path.join(batch.assetRoot,a.final))
 for(const offset of [0,128]){
  overlays.push({input:await sharp(raw).resize(128,128).png().toBuffer(),left:(i%columns)*256+offset,top:Math.floor(i/columns)*280})
  overlays.push({input:await sharp(raw).resize(64,64).png().toBuffer(),left:(i%columns)*256+offset+32,top:Math.floor(i/columns)*280+164})
 }
}
await sharp(Buffer.from(backgrounds)).composite(overlays).png().toFile(path.join(batch.assetRoot,'icons-qa.png'))
await fs.writeFile(manifestPath,JSON.stringify(batch,null,2)+'\n')
const cards=batch.assets.map(a=>`<article><h2>${a.target.name} · ${a.slot}</h2><img class="${a.slot}" src="${a.final}"/><p>${a.width}×${a.height} · ${a.mimeType} · ${a.bytes} bytes</p></article>`).join('')
await fs.writeFile(path.join(batch.assetRoot,'review.html'),`<!doctype html><html lang="ru"><meta charset="utf-8"><title>RED — batch ${batch.batch}</title><style>body{background:#1d1d22;color:#eee;font:16px system-ui;padding:24px}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(340px,1fr));gap:24px}article{background:#29292f;padding:20px;border-radius:16px}.cover{width:100%}.icon{width:128px;height:128px}h2{font-size:20px}p{color:#aaa}</style><h1>Cyberpunk RED · батч ${batch.batch}</h1><img src="icons-qa.png" style="max-width:100%"><main>${cards}</main></html>`)
