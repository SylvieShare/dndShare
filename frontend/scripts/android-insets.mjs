export function androidInsets() {
  return {
    postcssPlugin: 'dndshare-android-insets',
    Declaration(declaration) {
      if (declaration.value.includes('--native-safe-')) return
      declaration.value = declaration.value.replace(/env\(safe-area-inset-(top|bottom)\)/g,
        (_, side) => `max(env(safe-area-inset-${side}), var(--native-safe-${side}, 0px))`)
    },
  }
}
