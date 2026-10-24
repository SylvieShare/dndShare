package web

func mapModelToolDefinitions() []map[string]any {
	asset := mcpObjectSchema(map[string]any{
		"kind":     map[string]any{"type": "string", "enum": []string{"render", "lod", "shadow", "preview", "source"}},
		"fileName": mcpStringProperty("Original filename with .glb, .stl or .webp extension"),
		"sha256":   mcpStringProperty("Lowercase SHA-256 of the complete file"),
		"size":     mcpIntegerProperty("Exact byte size; GLB up to 32 MiB, WebP up to 4 MiB, source up to 256 MiB"),
	}, "kind", "fileName", "sha256", "size")
	complete := mcpObjectSchema(map[string]any{
		"kind":     asset["properties"].(map[string]any)["kind"],
		"fileName": mcpStringProperty("Original filename"), "sha256": mcpStringProperty("Expected SHA-256"),
		"size": mcpIntegerProperty("Expected byte size"), "uploadKey": mcpStringProperty("Temporary key returned by prepare_upload"),
	}, "kind", "fileName", "sha256", "size", "uploadKey")
	return []map[string]any{
		mapModelCatalogueToolDefinition(),
		mapModelCellsToolDefinition(),
		mcpDefinition("map_tile_model_grouping_update", "Atomically assign catalogue section code and variant-family code to up to 1000 definitions. Uses expectedCode/expectedVariantCode compare-and-swap; idempotent retries accepted. Empty variantCode makes a standalone tile. Preserves assets, geometry, lights and transitions. Requires MCP writes.", mcpObjectSchema(map[string]any{
			"models": map[string]any{"type": "array", "minItems": 1, "maxItems": 1000, "items": mcpObjectSchema(map[string]any{
				"definitionId": mcpStringProperty("Stable logical model ID"), "expectedCode": mcpStringProperty("Fresh current section code"), "expectedVariantCode": mcpStringProperty("Fresh current variant code, including empty string"), "code": mcpStringProperty("Section code, e.g. MED-ground"), "variantCode": mcpStringProperty("Variant family, e.g. MED-ground-straight; empty for standalone")}, "definitionId", "expectedCode", "expectedVariantCode", "code", "variantCode")},
		}, "models")),
		mcpDefinition("map_tile_model_group_update", "Change the catalogue section code (preserves variantCode) by stable definitionId without creating asset versions or changing placement, lights or transitions. Read the current code via model_get/list first; stale expectedCode is rejected. Repeating the same target code is idempotent. Requires MCP writes.", mcpObjectSchema(map[string]any{
			"definitionId":        mcpStringProperty("Stable logical model ID, e.g. MH-031; not a model UUID"),
			"expectedCode":        mcpStringProperty("Current section code from a fresh model read"),
			"expectedVariantCode": mcpStringProperty("Current variantCode including empty string; required to preserve reviewed classification"),
			"code":                mcpStringProperty("Target section code with unchanged pack prefix and lower-kebab-case name, e.g. MH-campfire"),
		}, "definitionId", "expectedCode", "expectedVariantCode", "code")),
		mcpDefinition("map_tile_model_register_preview", "Attach a verified transparent WebP preview to the current model. Checks the expected render hash; preserves all placement metadata, shared behaviour and four other assets without re-uploading them. Requires MCP writes.", mcpObjectSchema(map[string]any{
			"id": mcpStringProperty("Existing model UUID"), "expectedRenderSHA256": mcpStringProperty("Render SHA-256 used to generate this preview"),
			"asset": map[string]any{"type": "object", "description": "Transparent WebP asset metadata returned by complete_upload"},
		}, "id", "expectedRenderSHA256", "asset")),
		mcpDefinition("map_tile_model_behaviour_get", "Get shared transitions and embedded light templates by stable model definitionId, e.g. UD-010. Includes the revision required for updates.", mcpObjectSchema(map[string]any{"definitionId": mcpStringProperty("Stable logical model ID; not the model UUID")}, "definitionId")),
		mcpDefinition("map_tile_model_behaviour_update", "Replace shared model behaviour with compare-and-swap revision. Preserves model geometry and assets, geometry and S3 assets. Supply the complete current transitions and defaultLights; omitted entries are removed. Requires MCP writes.", mcpObjectSchema(map[string]any{
			"definitionId": mcpStringProperty("Stable logical model ID"),
			"behaviour":    map[string]any{"type": "object", "description": "Complete {revision, waterAnimation?:{enabled,speed:0..3,strength:0..2,pattern?:pool|surface|vortex,roughnessMax?:0..1,center?:[localX,localZ]}, defaultLights:[{key,name,kind,color,position:[x,y,height],intensity,radius,enabled,flicker,effect?:{kind:fire|none,size:[width,height],strength,offset:[x,y,height]}}], transitions:[{id,toDefinitionId,action}]}. Read first and retain unrelated water settings, lights and directed transitions. Water uses accepted PBR liquid channels; optional measured _WATER restricts the mask further. Surface waves use map coordinates; pool/vortex centres use model coordinates in cells. Height excludes mounting peg; position is local footprint coordinates."},
		}, "definitionId", "behaviour")),
		mcpDefinition("map_tile_models_list", "List current 3D tile catalogue metadata and registered S3 assets; no file bytes. Optional collection filter.", mcpObjectSchema(map[string]any{"collection": mcpStringProperty("Optional collection code")})),
		mcpDefinition("map_tile_model_get", "Get one current tile model and asset metadata.", mcpObjectSchema(map[string]any{"id": mcpStringProperty("Model UUID")}, "id")),
		mcpDefinition("map_tile_asset_prepare_upload", "Prepare a 15-minute signed PUT URL for a tile asset. Upload file bytes directly to Object Storage, not to the application or SSH server. Requires MCP writes; then call complete_upload.", asset),
		mcpDefinition("map_tile_asset_complete_upload", "Validate uploaded byte size, SHA-256 and format, promote it to a content-addressed S3 key without replacing existing content, then remove the temporary object. Returns asset metadata for registration. Requires MCP writes.", complete),
		mcpDefinition("map_tile_model_register_shadow", "Attach a verified shadow GLB to the current model. Preserves all placement metadata and other assets. Checks expected LOD hash against the current model; identical shadow registration is idempotent. Requires MCP writes.", mcpObjectSchema(map[string]any{
			"id":                mcpStringProperty("Existing model UUID"),
			"expectedLodSHA256": mcpStringProperty("LOD hash from the model used to prepare shadow geometry"),
			"asset":             map[string]any{"type": "object", "description": "Shadow asset metadata returned by complete_upload: key, sha256, size, mimeType, fileName"},
		}, "id", "expectedLodSHA256", "asset")),
		mcpDefinition("map_tile_model_register", "Publish current model metadata and assets after uploading. Existing models retain their UUID and update everywhere; no model history is kept. Omitted shadow uses the current matching LOD shadow or this LOD. Verifies S3 hashes and sizes. Identical registrations are idempotent. Requires MCP writes.", mcpObjectSchema(map[string]any{
			"model": map[string]any{"type": "object", "description": "Complete model metadata: id, code (catalogue section), variantCode (interchangeable family; empty for standalone), collection, collectionName, sourceCode, sourceName, name (Russian), nameEn (English), groupName (Russian section label), groupNameEn (English section label), category (floor/wall/water/railway/stairs/frame/bridge/passage/column/object/creature-base; independent of structural tileType), textureDetail (basic/detailed: texture workmanship, independent of geometry/LOD), tileType (floor/wall-straight/wall-angle/wall-tee/wall-cross/wall-end/wall-corner/wall-diagonal/bridge/passage/column/object/stairs/frame), hasDecor, canStand (shared availability for objects and characters), hidden, placementPoints [{x,y,elevation,cell:{x,y}}] (physical local footprint coordinates; elevation from mesh origin; required cell is a separate zero-based local grid coordinate within width/height), wallMode (center/edge/none), wallMask, width and height (occupied base cells; decorative overhangs allowed), placementOffset [x,z] (local mesh translation in cells before rotation), mountDepth (insertion peg depth below body datum; heights are measured from mesh origin), optional mountProfile (lower-kebab profile ID up to64 characters for mounted geometry), surfaceHeight, maxHeight, baseSize (creature-base only; exact token diameter in cells, 0.5..8; width/height must equal ceil(baseSize)), blockers, tags, supportSlots [{x,y,width,height,elevation,insertionRise?,insertionRises?}] (optional frame-only insertionRise0..0.15 raises incoming mounted tiles on a measured socket bevel; profile-specific insertionRises map overrides the default rise for the incoming mountProfile; up to16 profile keys and each rise0..0.15; physical elevation stays unchanged), and assets {render,lod,shadow,preview,source} (shadow optional on input; resolved on registration) returned by complete_upload"},
		}, "model")),
	}
}
