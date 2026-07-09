# File Size Rules

Use these thresholds when adding or changing frontend code.

- Up to 250 lines: fine.
- 250-400 lines: acceptable, but prefer extracting obvious state/workflow logic when touching the file.
- Over 400 lines: treat as a split candidate; new substantial work should extract composables or child components first.
- Over 600 lines: split before major behavior changes.
- Keep composables around 200-250 lines where practical.
- Large generated/schema renderers may exceed the target temporarily, but every touched section should move toward smaller composables/components.

Pages should stay thin. Put reusable UI into `shared/ui`, feature UI into `features/*/components`, feature workflows into `features/*/composables`, and pure helpers into `lib`.
