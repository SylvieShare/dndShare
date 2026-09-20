import fs from 'node:fs'
// Original, reproducible vector map; output is an application asset, not a UI mockup.
let seed = 72
const rand = () => ((seed = (1664525 * seed + 1013904223) >>> 0) / 4294967296)
const parts = [`<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1200" viewBox="0 0 1600 1200">
<defs><pattern id="paper" width="80" height="80" patternUnits="userSpaceOnUse"><rect width="80" height="80" fill="#ded2b6"/><path d="M4 15h4m16 47h3m31-31h4m-2 41h3M15 37h3" stroke="#8c7e63" opacity=".16"/></pattern><pattern id="water" width="80" height="40" patternUnits="userSpaceOnUse"><rect width="80" height="40" fill="#769896"/><path d="M0 12q10-4 20 0t20 0t20 0t20 0M20 30q10-4 20 0t20 0" stroke="#bdc9b4" stroke-width="2" fill="none" opacity=".6"/></pattern></defs>
<rect width="1600" height="1200" fill="url(#paper)"/>
<path d="M220-40C600 220 50 450 315 720S390 1050 300 1240" fill="none" stroke="#526a63" stroke-width="190"/>
<path d="M220-40C600 220 50 450 315 720S390 1050 300 1240" fill="none" stroke="url(#water)" stroke-width="176"/>
<path d="M690 1020L490 880L440 560L540 270L800 160L1230 180L1410 400L1410 820L1150 1030Z" fill="#c8bd9f" stroke="#514f45" stroke-width="20"/>
<path d="M690 1020L490 880L440 560L540 270L800 160L1230 180L1410 400L1410 820L1150 1030Z" fill="none" stroke="#b7ae97" stroke-width="12" stroke-dasharray="15 7"/>
<path d="M380 590H1470M750 150L790 1080M490 850L1360 310M580 320L1290 960" fill="none" stroke="#e9dfc5" stroke-width="46"/>
<path d="M190 565H495V619H190Z" fill="#c4b393" stroke="#575445" stroke-width="5"/>
<path d="M200 576H490M200 608H490" stroke="#686352" stroke-width="4"/>`]
for (let row = 0; row < 8; row++) for (let col = 0; col < 10; col++) {
  const x = 535 + col * 78 + rand() * 12, y = 295 + row * 79 + rand() * 13
  if (Math.abs(x-790)<55 || Math.abs(y-590)<48 || Math.abs(y-(1132-x*.56))<40 || Math.abs(y-(x*.86-180))<40 || (x>1090 && y<450)) continue
  const w=35+rand()*30,h=26+rand()*29,roof=['#98735c','#ac8265','#866e5b','#a48c70'][Math.floor(rand()*4)]
  parts.push(`<g transform="rotate(${Math.round(rand()*12-6)} ${x+w/2} ${y+h/2})"><rect x="${x+4}" y="${y+6}" width="${w}" height="${h}" fill="#565443" opacity=".25"/><rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${roof}" stroke="#544b40" stroke-width="2"/><path d="M${x} ${y}L${x+w/2} ${y+h/2}L${x+w} ${y}M${x+w/2} ${y+h/2}V${y+h}" stroke="#4d493e" fill="none" stroke-width="1.5"/></g>`)
}
parts.push(`<circle cx="790" cy="590" r="69" fill="#c1b497" stroke="#8b8169" stroke-width="2"/><circle cx="790" cy="590" r="21" fill="#73969b" stroke="#655d4f" stroke-width="7"/>
<g fill="#b7ad95" stroke="#504c43" stroke-width="6"><rect x="1120" y="235" width="170" height="160"/><rect x="1170" y="275" width="70" height="80"/><circle cx="1120" cy="235" r="25"/><circle cx="1290" cy="235" r="25"/><circle cx="1120" cy="395" r="25"/><circle cx="1290" cy="395" r="25"/></g>
<g stroke="#5c594b" stroke-width="9"><path d="M415 760H300M430 810H310M442 860H320"/></g>`)
for(let i=0;i<95;i++) {
  const x=rand()*1600,y=rand()*1200
  if(x>180&&x<1450&&y>140&&y<1080)continue
  parts.push(`<circle cx="${x+3}" cy="${y+5}" r="15" fill="#6b7860" opacity=".3"/><circle cx="${x}" cy="${y}" r="${9+rand()*8}" fill="#8c9b73" stroke="#6f7a5e" stroke-width="1.5"/>`)
}
parts.push(`<g font-family="Georgia,serif" fill="#47473e" text-anchor="middle"><text x="800" y="87" font-size="38" letter-spacing="8">РЕЧНОЙ ГОРОД</text><text x="790" y="704" font-size="23">Рыночная площадь</text><text x="1205" y="460" font-size="23">Цитадель</text><text x="505" y="923" font-size="23">Гавань</text><text x="791" y="118" font-size="13" letter-spacing="4">ДОРОГИ · КВАРТАЛЫ · НАБЕРЕЖНЫЕ</text></g>
<g transform="translate(1450 1050)" stroke="#535347" fill="none"><circle r="42" stroke-width="1"/><path d="M0-55L-10 10L0 0L10 10ZM0 0V50M-40 0H40" stroke-width="2"/><text y="-65" fill="#535347" text-anchor="middle" font-family="Georgia" font-size="22">С</text></g></svg>`)
fs.writeFileSync(new URL('../../frontend/public/maps/city.svg',import.meta.url),parts.join('\n'))
