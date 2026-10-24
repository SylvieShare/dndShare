package web

func creatureArchiveTools() []map[string]any {
	properties := map[string]any{"itemId": mcpIntegerProperty("Public handbook creature item ID"), "modelId": mcpStringProperty("Planned or registered model UUID"), "stage": map[string]any{"type": "string", "enum": []string{"native", "ready"}}, "sha256": mcpStringProperty("Lowercase SHA-256 of the complete tar.gz"), "size": mcpIntegerProperty("Exact compressed bytes, up to 512 MiB")}
	identity := mcpObjectSchema(properties, "itemId", "modelId", "stage", "sha256", "size")
	completeProperties := map[string]any{}
	for key, value := range properties {
		completeProperties[key] = value
	}
	completeProperties["uploadKey"] = mcpStringProperty("Temporary key returned by prepare_upload")
	return []map[string]any{
		mcpDefinition("creature_model_archive_prepare_upload", "Prepare a signed direct S3 upload for an immutable native/ready source archive. Works before the model is published. No changes to catalogue assets/bindings. Requires MCP writes.", identity),
		mcpDefinition("creature_model_archive_complete_upload", "Validate compressed SHA, byte size, safe regular tar files, per-file manifest hashes and required sources; promote to an immutable item/model/stage S3 key. Idempotent completion. Requires MCP writes.", mcpObjectSchema(completeProperties, "itemId", "modelId", "stage", "sha256", "size", "uploadKey")),
		mcpDefinition("creature_model_archive_list", "List source archive descriptors by handbook item, including planned/unpublished model UUIDs. Paginated S3 index; no catalogue or state changes.", mcpObjectSchema(map[string]any{"itemId": properties["itemId"], "cursor": mcpStringProperty("Optional nextCursor")}, "itemId")),
		mcpDefinition("creature_model_archive_get", "Get a 15-minute signed download URL for a known archive descriptor. Source archives are not loaded by the map renderer.", identity),
	}
}
