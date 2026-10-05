package web

func mapModelToolDefinitions() []map[string]any {
	asset := mcpObjectSchema(map[string]any{
		"kind":     map[string]any{"type": "string", "enum": []string{"render", "lod", "preview", "source"}},
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
		mcpDefinition("map_tile_models_list", "List versioned 3D tile catalogue metadata and registered S3 assets; no file bytes. Optional collection filter.", mcpObjectSchema(map[string]any{"collection": mcpStringProperty("Optional collection code")})),
		mcpDefinition("map_tile_model_get", "Get one immutable tile model version and asset metadata.", mcpObjectSchema(map[string]any{"id": mcpStringProperty("Model version UUID")}, "id")),
		mcpDefinition("map_tile_asset_prepare_upload", "Prepare a 15-minute signed PUT URL for a tile asset. Upload file bytes directly to Object Storage, not to the application or SSH server. Requires MCP writes; then call complete_upload.", asset),
		mcpDefinition("map_tile_asset_complete_upload", "Validate uploaded byte size, SHA-256 and format, promote it to a content-addressed S3 key without replacing existing content, then remove the temporary object. Returns asset metadata for registration. Requires MCP writes.", complete),
		mcpDefinition("map_tile_model_register", "Register an immutable model version after all four assets have been uploaded. Verifies S3 asset hashes and sizes. Identical registrations are idempotent; changing a version requires a new UUID and version number. Requires MCP writes.", mcpObjectSchema(map[string]any{
			"model": map[string]any{"type": "object", "description": "Complete model metadata: id, collection, collectionName, sourceCode, sourceName, name, version, tileType (floor/wall/prop/stairs/frame), terrainType, wallLayout, wallMode (center/edge/none), wallMask, width and height (occupied base cells; decorative overhangs allowed), placementOffset [x,z] (local mesh translation in cells before rotation), mountDepth (insertion peg depth below body datum; heights are measured from mesh origin), surfaceHeight, maxHeight, blockers, tags, supportSlots [{x,y,width,height,elevation}], and assets {render,lod,preview,source} returned by complete_upload"},
		}, "model")),
	}
}
