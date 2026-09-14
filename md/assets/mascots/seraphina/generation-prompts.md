# Промпты Серафины

Режим: встроенный `image_gen`. Канонические референсы —
[`canonical.png`](canonical.png) и [`portrait-icon.png`](portrait-icon.png).
Все пять поз сгенерированы независимо от этих двух референсов.

## Финальная коррекция пропорций булавы

```text
Use case: precise-object-edit.
Edit only the mace in this exact canonical Seraphina illustration to correct its proportions. The current mace head is OVERSIZED. Aim for a convincing balanced one-handed weapon between a tiny toy and an enormous fantasy club.
PRECISE CHANGE: Reduce the current steel flanged head to about 65% of its present height and width. Reduce the handle/shaft length to about 85% of its present length and its thickness to about 80%. As a visual measuring reference, the steel head alone should be approximately as tall as her FACE from eyebrow to chin, and narrower than her head: approximately 0.75–0.85 of the full forehead-to-chin facial height, excluding the gold tip. The complete mace should read as approximately 50–55 cm long for an adult human paladin, and its head about 12–15 cm long. The brown grip must sit comfortably inside one closed gauntlet, not force her fingers apart.
Keep the recognizable steel flanged construction with six broad robust flanges, simple old-gold collars and modest pommel. Tone down the disproportionately large gold tip and bottom pommel as part of resizing. It should be substantial through its solid metal construction and clear silhouette, not through extreme scale. Keep natural one-handed holding posture and keep the entire mace safely inside the image. No mace head larger than her human head, no two-handed maul, no staff, no hammer or axe, no toothpick shaft.
KEEP EVERY OTHER ELEMENT IDENTICAL: same exact approved human woman, face and warm smile, rounded ears, hair, body proportions, outfit, silver armor, ivory cape, golden chest sun, shield including its size, stance and boots, light ivory background, detailed matte 2D cel-painted style with clean deep-plum outline. Do not redraw the woman or change her pose except a minimal grip adjustment if necessary. No extra objects, text, scenery or checkerboard.
```

## Общая часть промптов поз

Для каждого файла к общей части добавлен соответствующий блок сцены ниже.

```text
Use case: stylized-concept.
Asset type: one full-body pose-and-emotion reference for the established DnD Share mascot SERAPHINA.
Input image 1 is the approved canonical full-body identity, costume, equipment and rendering reference. Input image 2 is the approved portrait icon for exact face identity. Create a NEW independently posed illustration of this SAME woman, not a recolor, collage, or repeated upright canonical stance.

STRICT IDENTITY: Adult HUMAN woman, mature softly angular face, natural small gray-green eyes, defined nose and cheekbones, small ordinary rounded human ears (NEVER elf ears), warm fair skin, long side-parted wavy pale ash-blonde hair swept away from her face in broad readable locks. Preserve the approved facial proportions and hair color while making the requested emotion unmistakable.
STRICT COSTUME: Same functional matte silver-gray full plate armor, angular overlapping pauldrons, high steel gorget with thin old-gold rim, unified breastplate with one golden sunburst, brown leather belt, layered hip plates, protected legs and flat plated boots, long ivory cape with sparse angular gold hem motifs and split ivory tabard. Keep the armor's construction, silhouette, colors and emblem placement recognizable.
EQUIPMENT: Same balanced one-handed steel flanged mace: total length roughly 50–55 cm, solid steel flanged head roughly 12–15 cm long, six broad blunt flanges, comfortable brown-wrapped grip with small restrained old-gold collars and pommel. Match its proportions to the final canonical reference, measuring head and grip against her face and gauntlet: the steel striking head is around 80–90% of her facial height and narrower than her head; total weapon length roughly from elbow to fingertips plus a palm. It must read as solid metal, not a light baton, and must NEVER be enlarged into a giant club. Same ivory heater shield with steel-and-gold rim and one large golden sunburst. Keep both items present, and follow the scene's handling instructions. Exactly one mace and one shield, no extra weapons, sword, candle, staff, horns or wings.
STRICT STYLE: Match the approved reference and the Lissara art family exactly: controlled detailed 2D cel-painted rendering, matte angular planes, broad readable shapes, clean deep-plum contour slightly heavier at the silhouette, restrained two-step shadow families and limited warm highlights. No gloss, photorealism, 3D rendering, chibi, oversized anime eyes, doll face, painterly grain, stippling, costume redesign, excessive ornament or micro-detail.
FRAMING: ONE complete full-body character, portrait 2:3 composition, natural adult proportions and anatomically credible stance; entire head, hands, feet, shield and mace remain within a comfortable 5–8% safe margin. No cropped limbs or weapon head, no duplicate hands, no extra fingers. Re-stage her limbs, weight and cloak naturally for the specified action.
BACKGROUND: uniform light warm ivory opaque background, no environment, floor, ground shadow, gradient, texture, checkerboard, text, labels, panels, frames, watermarks or detached decorative particles. Modest localized light only if specifically requested below.
```

## Защитная стойка

Файл: [protective-guard.png](protective-guard.png).

```text
SCENE: She steps forward to protect someone, leaning into a sturdy low defensive stance with one knee bent, weight grounded. Hold the sun shield up and forward to guard her torso, angled so its emblem and her entire face both remain visible; draw the mace close beside her rear hip ready to counter. Her eyes focus intently at an unseen threat off to the side, eyebrows knit, lips closed and firm: calm resolve and protective determination, NOT the canonical gentle smile. Cape flows gently behind from the movement. Do not add an attacker or impact effect.
```

## Удар булавой

Файл: [resolute-strike.png](resolute-strike.png).

```text
SCENE: A dynamic committed forward lunge at the moment before a forceful mace strike. One foot plants far forward, the rear leg pushes, torso rotates. Mace arm raised diagonally above and beside her shoulder, elbow naturally bent, mace fully visible and ready to swing; shield held outward on the opposite bent forearm guarding her flank, sun visible. Her expression is fierce confident battle enthusiasm: focused eyes, knitted brows and a small teeth-baring determined grin, not rage and not the neutral canonical smile. Hair and cape follow the rotation. No target, no motion streaks, no magical effect, no gore.
```

## Исцеление

Файл: [gentle-healing.png](gentle-healing.png).

```text
SCENE: She kneels on one knee, lower body fully visible, leaning toward the viewer with one open gauntleted hand extended gently, palm slightly upward as if offering a healing touch. Her expression is tender compassionate concern: brows softly raised inward, eyes attentive and kind, small reassuring closed-mouth smile distinct from a victory grin. A SINGLE small warm golden pool of light rests at the palm, with restrained nearby reflections on the gauntlet, no floating runes or particles. The mace is secured visibly in a simple belt loop at her hip, not floating; the other hand steadies the shield resting its pointed lower edge beside her bent knee. Preserve two hands and two legs with natural kneeling anatomy. No patient or other person.
```

## Радостное приветствие

Файл: [joyful-greeting.png](joyful-greeting.png).

```text
SCENE: A relaxed open joyful greeting: she stands with her weight on one leg, turns her upper body a little toward the viewer, lifts one free gauntleted hand into a natural open-palmed wave. Her expression is unmistakable spontaneous happy laughter, smile open enough to show a little upper teeth, cheeks lifted and eyes naturally narrowed with joy while retaining mature anatomy. The shield is held lowered on the other forearm and the mace hangs securely in a simple belt loop at the hip, each appearing once. Slight gentle head tilt, shoulders relaxed, warm confident presence. Hair follows the head tilt, cape falls naturally. No jumping, no extra companion, no emoji or sparkles.
```

## Испуг и отступление

Файл: [startled-retreat.png](startled-retreat.png).

```text
SCENE: A sudden startled recoil, clearly different from an intentional defensive advance. Weight shifts backward, one foot draws back, torso recoils slightly and shoulders tense. Reflexively raise the shield toward an unseen threat while keeping her entire face above the edge, hold the mace low at her other side with a tight credible grip. Her eyes widen naturally, eyebrows lift and pull together, lips part in a small involuntary breath: readable fear and surprise with adult natural proportions, not comical screaming or oversized cartoon eyes. Hair and cloak lag gently behind the retreat. No monster, no impact, no injury or magic.
```
