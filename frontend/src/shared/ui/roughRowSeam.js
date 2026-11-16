// Contours are generated once from fixed seeds, never while rendering or selecting.
// Y is relative to a row boundary, in hundredths of --spacing-small.
function contour(seed) {
  const next=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed}
  const points=[]
  for(let x=0;x<1000;x+=18+next()%25)points.push([x,(next()%57)-28])
  points.push([1000,(next()%57)-28])
  return points
}
const contours=[173,521,947,1381,2017].map(contour)
const index=value=>{const i=Number.isFinite(value)?Math.trunc(value):0;return (i%contours.length+contours.length)%contours.length}
const paths=contours.map(points=>points.map(([x,y],i)=>`${i?'L':'M'}${x} ${y}`).join(' '))
const paintStyles=contours.map((points,i)=>Object.freeze({'--roster-paint-clip':`polygon(${[
  ...points.map(([x,y])=>`${x/10}% calc(var(--spacing-small) * ${(50+y)/100})`),
  ...[...contours[index(i+1)]].reverse().map(([x,y])=>`${x/10}% calc(100% - var(--spacing-small) * ${(50-y)/100})`),
].join(',')})`}))

export const roughRowSeamPath=variant=>paths[index(variant)]
// The lower edge uses the next boundary, shared with the following row's upper edge.
export const roughRowPaintStyle=rowIndex=>paintStyles[index(rowIndex)]
