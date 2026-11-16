// A shared contour for a separator and both edges of the adjoining row paint.
// Y is relative to the row boundary, in hundredths of --spacing-small.
const points = [[0,6],[19,-8],[37,12],[65,-22],[91,-10],[114,19],[139,3],[157,-15],
  [193,8],[224,-27],[243,-5],[278,15],[303,-14],[337,-4],[359,23],[388,2],
  [411,-18],[443,9],[469,-7],[496,25],[527,-9],[550,-24],[578,5],[609,-12],
  [636,17],[657,-3],[684,-20],[718,13],[747,4],[771,-14],[803,22],[827,-2],
  [856,-25],[882,7],[913,-9],[941,17],[967,-13],[985,5],[1000,-4]]

export const roughRowSeamPath = points.map(([x,y],i)=>`${i?'L':'M'}${x} ${y}`).join(' ')
export const roughRowPaintClip = `polygon(${[
  ...points.map(([x,y])=>`${x/10}% calc(var(--spacing-small) * ${(50+y)/100})`),
  ...[...points].reverse().map(([x,y])=>`${x/10}% calc(100% - var(--spacing-small) * ${(50-y)/100})`),
].join(',')})`
