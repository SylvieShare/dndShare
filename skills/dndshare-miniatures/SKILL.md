---
name: dndshare-miniatures
description: Create, refine, validate and publish static textured creature miniatures for DnD Share from handbook art, or correct their equipment, materials and standing scale. Use for item-bound game models, not map tiles or printable figurines.
---

# DnD Share miniatures

Work in the dndShare repository. Read its README first. This skill's maintained
source lives in `skills/dndshare-miniatures`; a personal installation may be a
symlink. Resolve that symlink before resolving repository-relative paths.

Read [the miniature pipeline](../../md/features/creature-model-pipeline.md)
for commands and acceptance criteria. For binding/storage/rendering changes read
[item models](../../md/features/item-models.md). Read the relevant recipe in
`scripts/creatures/` before changing an accepted model.

## Choose the work

- **New species:** handbook item and illustration → accepted image of a solid
  miniature → native textured TRELLIS mesh → editable scene and optimized assets.
  Use the available imagegen skill/tool for the reference. Multi-view images
  help art review but do not prove a usable exported 3D mesh exists.
- **Variant:** reuse an accepted compatible body. Construct connected equipment
  and fit clothing against the torso. Do not regenerate an accepted body merely
  to add a spear, cloak or backpack.
- **Correction:** diagnose transforms, mesh, PBR factors and effective textures
  separately. Preserve accepted geometry/texture bytes when fixing metadata or
  a material factor. Rebuild only affected stages.

## Invariants that caused real failures

- `token.size` owns occupied cells. `referenceDiameter` owns the model's virtual
  standing circle in native GLB units. Body scale is `.7*size/referenceDiameter`:
  a 2-cell version of the same body is exactly twice its 1-cell version. Base
  diameter is `size - min(.3, .3*size)`; its fixed outer wall clearance must not
  enlarge the body. For Large, body target is 1.4 versus base diameter 1.7
  (14/17 compensation). Apply this in runtime and review renders; do not also
  shrink the GLB or adjust its recipe calibration to compensate twice.
  Weapons, tails and wings may overhang. Never fit the whole silhouette into
  a token circle.
- Use the same coordinate transform for source, render, LOD and shadow. Feet
  are at Y=0 after GLB export, the standing centre is X/Z=0. Preserve the full
  native node hierarchy/matrices; tiny stones with scaled nodes once became
  giant polygons because their native matrices were discarded.
- Bodies have no embedded base. Bases are separate resources; their
  `referenceDiameter` is their measured outer diameter. Scale a base in X/Z
  only, keeping thickness and standing height constant. Verify against the
  runtime formula, including a 2×2 example.
- Organic surfaces are dielectric. Inspect effective metalness, roughness,
  normal map and colour spaces before changing lights. Use `dielectric` only
  when every visible surface warrants it; metal armour needs a mixed material
  treatment. Do not brighten textures to conceal faulty PBR.
- Clothing is a connected volume fitted to the torso, with shoulder/side joins
  and openings. Check both side views and the back. Hide covered skin faces
  without cutting holes around neck/arm openings. Floating rectangular sheets
  are a failed result, even when the front view looks acceptable.
- LOD must preserve stance, proportions and thin appendages. Triangle budgets
  are starting points; the owlbear needed 24k rather than 12k for its feathers.
  A bounds test alone does not verify silhouette or baked shading.
- Keep native export, reference, prompt, recipe and reports. Never label a
  visual hull or views-only run as a native mesh export.

## Execution and delivery

Use isolated background Blender processes; do not overwrite an open user scene.
Keep work and binary assets under ignored `models/creatures/`; publish served
files in S3 through the existing registry. Commit recipes, tools and wiki.

Service credentials stay in process memory or the user's configured credential
store, never in prompts, recipes, command arguments or reports. Use the existing
hidden-input/auth options. Honour current authorization and quota/budget limits;
this skill itself does not authorize a paid generation or live publication.
Do not persist volatile service prices or quotas here. If a generation/export
fails on quota, preserve its outputs and stop remote retries until the reason
is resolved; do not silently generate another paid attempt. Repeat the same
command/output folder to resume its checkpoint. After an unknown submission or
an expired session, stop; do not bypass that guard by creating another generation
without the current task authorizing a new attempt. `--status` is local and does
not request a key. A completed local GLB needs no service calls.

Review neutral light, grey material, front/back/both sides/top, render versus
LOD, and actual placement against walls. Record visible weaknesses. Run the
silhouette comparison after optimization, then the verifier on the exact final
files, then package and dry-run publication. Failed/stale silhouette reports
block publication. Read [recovery and LOD checks](../../md/features/creature-model-checks.md)
when resuming generation or investigating a failed comparison.
Publication is complete only after reading back manifests, calibration and
bindings. On interrupted updates, retry the reviewed bundle; refuse changed
assets or metadata rather than overwriting someone else's work.

Deliver the usable model/registry result, recipe and verification report, with
any remaining visible limitations. Do not call technical validation alone an
art-quality approval.
