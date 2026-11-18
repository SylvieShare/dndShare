// Contours are generated once from fixed seeds, never while rendering or selecting.
// Y is relative to a row boundary, in hundredths of --spacing-small.
function contour(seed, step = 18, variation = 25) {
  const next=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed}
  const points=[]
  for(let x=0;x<1000;x+=step+next()%variation)points.push([x,(next()%57)-28])
  points.push([1000,(next()%57)-28])
  return points
}
const seeds=[173,521,947,1381,2017]
const contours=seeds.map(seed=>contour(seed))
const sides=seeds.map(seed=>contour(seed,56,72).slice(1,-1))
const index=value=>{const i=Number.isFinite(value)?Math.trunc(value):0;return (i%contours.length+contours.length)%contours.length}
const paths=contours.map(points=>points.map(([x,y],i)=>`${i?'L':'M'}${x} ${y}`).join(' '))
const polygon=points=>`polygon(${points.join(',')})`
const topY=y=>`calc(var(--spacing-small) * ${(50+y)/100})`
const bottomY=y=>`calc(100% - var(--spacing-small) * ${(50-y)/100})`
const sideY=y=>`calc(var(--spacing-small) + (100% - 2 * var(--spacing-small)) * ${y/1000})`
const sideDepth=x=>`var(--spacing-small) * ${(28+x)/100}`

function paintStyle(points, i, roughSides) {
  const bottom=contours[index(i+1)]
  const topEdge=points.map(([x,y])=>`${x/10}% ${topY(y)}`)
  const bottomEdge=[...bottom].reverse().map(([x,y])=>`${x/10}% ${bottomY(y)}`)
  if (!roughSides) return Object.freeze({ '--roster-paint-clip': polygon([...topEdge, ...bottomEdge]) })

  const right=sides[index(i+2)].map(([y,x])=>`calc(100% - ${sideDepth(x)}) ${sideY(y)}`)
  const left=[
    ['0px', topY(points[0][1])],
    ...sides[i].map(([y,x])=>[`calc(${sideDepth(x)})`, sideY(y)]),
    ['0px', bottomY(bottom[0][1])],
  ]
  const stripe=left.map(([x,y])=>`${x} ${y}`)
  const stripeInset=[...left].reverse().map(([x,y])=>`calc(${x} + 3 * var(--layout-border)) ${y}`)
  return Object.freeze({
    '--roster-paint-clip': polygon([...topEdge, ...right, ...bottomEdge, ...stripe.slice(1,-1).reverse()]),
    '--roster-color-edge-clip': polygon([...stripe, ...stripeInset]),
  })
}

const flatEdge=[[0,0],[1000,0]]
const paintStyles={
  seam:contours.map((points,i)=>paintStyle(points,i,false)),
  scene:contours.map((points,i)=>paintStyle(points,i,true)),
  flatTop:contours.map((_,i)=>paintStyle(flatEdge,i,false)),
}

export const roughRowSeamPath=variant=>paths[index(variant)]
// The lower edge uses the next boundary, shared with the following row's upper edge.
export const roughRowPaintStyle=(rowIndex,variant='seam')=>paintStyles[variant][index(rowIndex)]
