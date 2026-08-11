# File Size Rules

Use these thresholds for hand-written implementation files in frontend and
backend. The line count is a design signal, not a reason to compress readable
code onto fewer physical lines.

- Up to 250 lines: fine.
- 250-400 lines: acceptable, but prefer extracting obvious state/workflow logic when touching the file.
- Over 400 lines: treat as a split candidate; new substantial work should extract composables or child components first.
- 600 lines is the hard ceiling: split by responsibility before merging a file
  that would exceed it.
- Keep composables around 200-250 lines where practical.
- Generated artifacts may exceed the ceiling only when they are not maintained
  by hand. SQL schema and large renderers are still split into ordered domain
  files, composables and child components.

Pages should stay thin. Put reusable UI into `shared/ui`, feature UI into `features/*/components`, feature workflows into `features/*/composables`, and pure helpers into `lib`.

For Go, keep transport/dispatch in the feature entry file and move domain
handlers, validation, payload construction and data access into focused sibling
files. A split must preserve one public feature boundary rather than creating
parallel implementations or compatibility fallbacks.
