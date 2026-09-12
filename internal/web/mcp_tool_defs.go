package web

func mcpToolDefs() []map[string]any {
	strP := func(desc string) map[string]any { return map[string]any{"type": "string", "description": desc} }
	intP := func(desc string) map[string]any { return map[string]any{"type": "integer", "description": desc} }
	boolP := func(desc string) map[string]any { return map[string]any{"type": "boolean", "description": desc} }
	schema := func(props map[string]any, required ...string) map[string]any {
		if required == nil {
			required = []string{}
		}
		return map[string]any{"type": "object", "properties": props, "required": required}
	}
	tool := func(name, desc string, input map[string]any) map[string]any {
		return map[string]any{"name": name, "description": desc, "inputSchema": input}
	}

	return []map[string]any{
		tool("sessions_list",
			"List active sessions owned by one exact user login. Returns session metadata without participants or character sheets.",
			schema(map[string]any{"ownerLogin": strP("Exact owner login")}, "ownerLogin")),
		tool("session_adventure_get",
			"Read the complete authored campaign projection for one session owned by the supplied login: arcs, chapters, scenarios, blocks, world entities, materials and graph edges. Does not expose participants or character sheets.",
			schema(map[string]any{
				"ownerLogin":  strP("Exact owner login"),
				"sessionUuid": strP("Session UUID"),
			}, "ownerLogin", "sessionUuid")),
		tool("session_adventure_import",
			"Atomically create a session and import a portable adventure for one existing user. The document is a JSON string with stable local keys for arcs, chapters, scenarios, blocks, locations, NPCs, quests, text/note materials and their edges/relations. System catalogue images are selected by imageKey. Any invalid reference rolls back the whole session. Requires MCP write operations to be enabled.",
			schema(map[string]any{
				"ownerLogin": strP("Exact existing user login that will own the session"),
				"document":   strP("Portable SessionAdventureDocument encoded as one JSON object string"),
			}, "ownerLogin", "document")),
		tool("handbook_sources",
			"List handbook systems. Returns id, name, versions [{id, sourceId, version}], countItems.",
			schema(map[string]any{})),
		tool("handbook_item_types",
			"List item types (handbook object categories such as enemies, weapons). Each type's `fields` array describes handbook item `data`; `instanceFields` describes typed `params` stored on owned or granted item references. Read this before creating or updating items.",
			schema(map[string]any{"sourceId": intP("Optional source id to filter by")})),
		tool("handbook_items",
			"List base (shared) items of a given type, paginated.",
			schema(map[string]any{
				"typeId": intP("Item type id"),
				"limit":  intP("Max rows, 1..500 (default 50)"),
				"offset": intP("Offset for pagination (default 0)"),
			}, "typeId")),
		tool("handbook_items_search",
			"Search base (shared) items of a type by Russian or English name/nameEn (case-insensitive substring).",
			schema(map[string]any{
				"typeId": intP("Item type id"),
				"q":      strP("Name query"),
				"limit":  intP("Max rows, 1..500 (default 20)"),
			}, "typeId", "q")),
		tool("handbook_items_get",
			"Fetch items by their ids (any owner).",
			schema(map[string]any{
				"ids": map[string]any{"type": "array", "items": map[string]any{"type": "integer"}, "description": "Item ids"},
			}, "ids")),
		tool("handbook_suggest_types",
			"List suggest types (dictionary categories). Returns id, name, source, color, countItems.",
			schema(map[string]any{"sourceId": intP("Optional source id to filter by")})),
		tool("handbook_suggests",
			"List base (shared) suggests (dictionary values) of a given type.",
			schema(map[string]any{"typeId": intP("Suggest type id")}, "typeId")),
		tool("handbook_suggests_search",
			"Search base (shared) suggests across all types by value (case-insensitive substring).",
			schema(map[string]any{
				"q":     strP("Value query"),
				"limit": intP("Max rows, 1..100 (default 20)"),
			}, "q")),
		tool("handbook_item_create",
			"Create a base (shared, user_id=null) item. Use handbook_item_types first to learn the `data` schema for the given typeId.",
			schema(map[string]any{
				"automationStatus":          map[string]any{"type": "string", "enum": []string{"unreviewed", "full", "partial", "none", "not_applicable"}, "description": "Site mechanics coverage; omitted on update preserves status. Explicit review, never infer from dependency count."},
				"automationNote":            strP("Optional explanation of coverage or limitations, up to 1000 characters. Empty string clears it."),
				"requiresPlayerInteraction": map[string]any{"type": "boolean", "description": "Requires another player's character; independent of coverage status."},
				"typeId":                    intP("Item type id"),
				"name":                      strP("Display name (Russian)"),
				"nameEn":                    strP("English name"),
				"data":                      strP("JSON object string with the item data matching the type's fields schema"),
				"parentId":                  intP("Normalized parent item id for a type-16 subrace or type-17 subclass. The server keeps data.race/data.class and the reverse base-item list synchronized. Omit for base items."),
			}, "typeId", "name", "nameEn", "data")),
		tool("handbook_item_update",
			"Update an item by id (admin: works for any owner including base items).",
			schema(map[string]any{
				"automationStatus":          map[string]any{"type": "string", "enum": []string{"unreviewed", "full", "partial", "none", "not_applicable"}, "description": "Site mechanics coverage; omitted on update preserves status. Explicit review, never infer from dependency count."},
				"automationNote":            strP("Optional explanation of coverage or limitations, up to 1000 characters. Empty string clears it."),
				"requiresPlayerInteraction": map[string]any{"type": "boolean", "description": "Requires another player's character; independent of coverage status."},
				"id":                        intP("Item id"),
				"name":                      strP("Display name (Russian)"),
				"nameEn":                    strP("English name"),
				"data":                      strP("JSON object string with the full item data"),
				"parentId":                  intP("Normalized parent item id. Pass -1 to clear only for item types that allow it; type-16 subraces and type-17 subclasses require a base parent. Omit to derive/keep the origin relation from data.race or data.class."),
			}, "id", "name", "data")),
		tool("handbook_item_set_content_sources",
			"Set the handbook book/source links of an item. Replaces only source links, preserves item data.",
			schema(map[string]any{
				"id":               intP("Item id"),
				"contentSourceIds": map[string]any{"type": "array", "items": map[string]any{"type": "integer"}},
			}, "id", "contentSourceIds")),
		tool("handbook_item_delete",
			"Delete an item by id (admin: works for any owner including base items).",
			schema(map[string]any{"id": intP("Item id")}, "id")),
		tool("handbook_item_set_system_image",
			"Upload and assign an icon or cover to a base system handbook item. Accepts plain standard base64, stores the image in S3 under a content-addressed key, and replaces the selected slot. By default an unreferenced previous asset is removed; preservePrevious=true keeps its storage row and S3 object for later reuse. Icons allow PNG/WebP up to 5 MB; covers allow JPEG/PNG/WebP up to 10 MB. Requires MCP write operations to be enabled and never changes user-owned items.",
			schema(map[string]any{
				"itemId":           intP("Positive id of a base system item (user_id must be null)"),
				"slot":             map[string]any{"type": "string", "enum": []string{"icon", "cover"}, "description": "Image slot"},
				"fileName":         strP("Original file name stored as metadata"),
				"mimeType":         strP("Exact image MIME type matching the bytes"),
				"dataBase64":       strP("Plain standard base64 without a data URL prefix"),
				"preservePrevious": boolP("Keep the replaced storage row and S3 object instead of deleting an unreferenced asset (default false)"),
			}, "itemId", "slot", "fileName", "mimeType", "dataBase64")),
		tool("handbook_item_type_set_system_image",
			"Upload and assign an icon or fallback cover to a handbook item type. Item-level media keeps priority over the type fallback. Accepts plain standard base64, stores the image in S3 under a content-addressed key, and replaces the selected slot. By default an unreferenced previous asset is removed; preservePrevious=true keeps it. Icons allow PNG/WebP up to 5 MB; covers allow JPEG/PNG/WebP up to 10 MB. Requires MCP write operations to be enabled.",
			schema(map[string]any{
				"typeId":           intP("Positive handbook item type id"),
				"slot":             map[string]any{"type": "string", "enum": []string{"icon", "cover"}, "description": "Image slot"},
				"fileName":         strP("Original file name stored as metadata"),
				"mimeType":         strP("Exact image MIME type matching the bytes"),
				"dataBase64":       strP("Plain standard base64 without a data URL prefix"),
				"preservePrevious": boolP("Keep the replaced storage row and S3 object instead of deleting an unreferenced asset (default false)"),
			}, "typeId", "slot", "fileName", "mimeType", "dataBase64")),
		tool("handbook_bestiary_migrate_icons_to_covers",
			"Audit or migrate legacy raster icons of base bestiary items into their cover slot without uploading or deleting S3 objects. Existing covers are never overwritten. Pass kobold or other protected item ids in excludeItemIds. The default apply=false is a dry-run; apply=true requires MCP write operations and an expectedCandidateCount equal to the preceding dry-run result.",
			schema(map[string]any{
				"excludeItemIds":         map[string]any{"type": "array", "items": map[string]any{"type": "integer"}, "description": "Base bestiary item ids to leave unchanged (default empty)"},
				"apply":                  boolP("Apply the migration; default false performs a dry-run"),
				"expectedCandidateCount": intP("Required with apply=true; must match candidateCount from the latest dry-run"),
			})),
		tool("handbook_suggest_create",
			"Create a base (shared, user_id=null) suggest in the given type.",
			schema(map[string]any{
				"typeId": intP("Suggest type id"),
				"value":  strP("Display value"),
				"code":   strP("Optional code/key"),
				"color":  strP("Optional hex color"),
				"desc":   strP("Optional description/tooltip"),
			}, "typeId", "value")),
		tool("handbook_suggest_update",
			"Update a suggest by id+typeId (admin: works for any owner including base). Preserves the existing svg icon.",
			schema(map[string]any{
				"typeId": intP("Suggest type id"),
				"id":     intP("Suggest id"),
				"value":  strP("Display value"),
				"code":   strP("Optional code/key"),
				"color":  strP("Optional hex color"),
				"desc":   strP("Optional description/tooltip"),
			}, "typeId", "id", "value")),
		tool("handbook_suggest_set_svg",
			"Set or replace the svg icon of a suggest by id+typeId (admin: works for any owner including base). Pass raw <svg> markup; an empty string clears the icon. Stores the markup in svg_storage, repoints the suggest, and removes the previous svg row.",
			schema(map[string]any{
				"typeId": intP("Suggest type id"),
				"id":     intP("Suggest id"),
				"svg":    strP("Raw SVG markup (e.g. <svg ...>...</svg>); empty string clears the icon"),
			}, "typeId", "id", "svg")),
		tool("handbook_suggest_delete",
			"Delete a suggest by id+typeId (admin: works for any owner including base).",
			schema(map[string]any{
				"typeId": intP("Suggest type id"),
				"id":     intP("Suggest id"),
			}, "typeId", "id")),
	}
}
