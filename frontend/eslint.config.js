import vue from 'eslint-plugin-vue'
import globals from 'globals'

export default [
  { linterOptions: { reportUnusedDisableDirectives: 'off' } },
  ...vue.configs['flat/base'],
  {
    files: ['src/**/*.{js,vue}'],
    languageOptions: { globals: { ...globals.browser, ...globals.es2024, ...globals.worker } },
    rules: { 'no-undef': 'error' },
  },
  { files: ['src/**/*.test.js'], languageOptions: { globals: globals.node } },
]
