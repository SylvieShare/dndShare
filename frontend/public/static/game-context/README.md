# Game-system logos

The user supplied the D&D dragon wordmark and the Vampire: The Masquerade ankh.
Both were processed with the built-in `image_gen` tool (not the CLI) to remove
the background and recolor the foreground. Production copies retain alpha
and are downsampled to a maximum edge of 144 px for the 36 px UI slot.

- `dnd-logo.png`: shared by D&D 5e 2014 and 2024.
- `vampire-ankh.png`: Vampire: The Masquerade.
- `generic.svg`: the application's neutral fallback for other systems.

`GameContextEmblem.vue` uses the images as alpha masks, so the visible color
always follows `var(--accent)`. There is no surrounding tile or frame.

## Final built-in prompts

### D&D

Precise image edit for a website logo icon. Preserve the exact supplied D&D silhouette and all dragon/letter contours and internal cutouts, no redesign. Remove the white background including all white internal negative spaces, use true alpha transparency. Recolor every foreground pixel to flat purple #7c5ce2, only antialiased edges may vary alpha. No shading, outlines, shadows, glow, tile, text additions, or background. Crop canvas tightly to the horizontal logo with minimal transparent margin, keeping original ~2.1:1 logo proportions. Output transparent PNG suitable for use as a CSS alpha mask. This is an exact background removal and recolor, not a creative reinterpretation.

### Vampire

Precise image edit for a website logo icon. Preserve EXACTLY the supplied Vampire The Masquerade elongated ankh/sword symbol: oval loop, central diamond spur, curved horizontal arms, very long tapered blade. Preserve all contours and original ~500:1175 silhouette proportions. Remove any background completely, all negative space must be true alpha transparency. Recolor the foreground to solid flat purple #7c5ce2, antialiased edges can vary alpha. No new outline, shading, shadows, glow, tile, letters or ornament. Crop tightly to the symbol with minimal transparent margin. Output transparent PNG to be used as CSS alpha mask. Exact background removal and recolor only, do not reinterpret the shape.
