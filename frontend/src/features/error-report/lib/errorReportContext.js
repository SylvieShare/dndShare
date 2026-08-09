export function platformForViewport(width) {
  return Number(width) <= 640 ? 'mobile' : 'desktop'
}
