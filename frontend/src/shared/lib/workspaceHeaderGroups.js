export function workspaceHeaderGroups({ width, identity, actions, details = null, context = null, gap = 0, offset = 0, placement = 'auto' }) {
  if (details == null) return {
    detailsInline: false, contextInDetailsRow: false,
    contextInline: context != null && (placement === 'inline' || placement === 'auto' && width - identity - actions - 2 * gap - offset >= context),
  }
  const detailsInline = width >= identity + details + actions + 3 * gap
  const contextInline = context != null && (placement === 'inline' || placement === 'auto' && detailsInline && width >= identity + details + context + actions + 3 * gap + offset)
  return { detailsInline, contextInline,
    contextInDetailsRow: context != null && !contextInline && !detailsInline && placement === 'auto' && width >= details + context + gap + offset }
}
