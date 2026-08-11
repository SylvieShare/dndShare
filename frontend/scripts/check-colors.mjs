import fs from 'node:fs'
import path from 'node:path'

const sourceRoot = path.resolve(import.meta.dirname, '../src')
const allowedRawColorFiles = new Set([
  path.join(sourceRoot, 'app/theme.css'),
  // These are data visualizations whose colors describe the object itself, not application chrome.
  path.join(sourceRoot, 'features/items/components/PotionVial.vue'),
  path.join(sourceRoot, 'features/items/components/SpellSlotSphere.vue'),
  path.join(sourceRoot, 'shared/ui/SystemDie.vue'),
  // The print-only character sheet is deliberately isolated from the dark app theme:
  // its monochrome ink/paper palette must be stable in browsers and generated PDFs.
  path.join(sourceRoot, 'features/character-editor/pages/ViewCharacterPrint.vue'),
  path.join(sourceRoot, 'features/character-editor/components/print/PrintPage.vue'),
  path.join(sourceRoot, 'features/character-editor/components/print/PrintSpellCard.vue'),
  path.join(sourceRoot, 'features/character-editor/components/print/PrintFeatureCard.vue'),
])
const rawColor = /#[0-9a-f]{3,8}\b|rgba?\s*\(|hsla?\s*\(|(?<![-\w])(?:white|black)(?![-\w])/i
const deprecatedToken = /--(?:bg-deep|block-bg|surface-[12]|surface-hover|popup-bg|input-(?:bg|border|focus)|accent-(?:dim|2)|danger-dim|color-attack|control-bg)\b/

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name)
    return entry.isDirectory() ? walk(fullPath) : [fullPath]
  })
}

const failures = []

for (const file of walk(sourceRoot)) {
  if (!/\.(?:vue|css)$/.test(file)) continue
  const source = fs.readFileSync(file, 'utf8')
  const styles = file.endsWith('.css')
    ? source
    : [...source.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)].map((match) => match[1]).join('\n')

  styles.split('\n').forEach((line, index) => {
    if (!allowedRawColorFiles.has(file) && rawColor.test(line)) {
      failures.push(`${path.relative(sourceRoot, file)}:${index + 1}: direct color: ${line.trim()}`)
    }
    if (deprecatedToken.test(line)) {
      failures.push(`${path.relative(sourceRoot, file)}:${index + 1}: deprecated token: ${line.trim()}`)
    }
  })
}

if (failures.length) {
  console.error('Color token check failed:\n' + failures.join('\n'))
  process.exit(1)
}

console.log('Color token check passed.')
