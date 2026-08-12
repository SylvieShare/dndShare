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
		tool("handbook_sources",
			"List handbook systems. Returns id, name, versions [{id, sourceId, version}], countItems.",
			schema(map[string]any{})),
		tool("handbook_item_types",
			"List item types (handbook object categories such as enemies, weapons). Each type's `fields` array is the schema describing which keys are allowed in an item's `data`. Read this before creating or updating items.",
			schema(map[string]any{"sourceId": intP("Optional source id to filter by")})),
		tool("handbook_items",
			"List base (shared) items of a given type, paginated.",
			schema(map[string]any{
				"typeId": intP("Item type id"),
				"limit":  intP("Max rows, 1..500 (default 50)"),
				"offset": intP("Offset for pagination (default 0)"),
			}, "typeId")),
		tool("handbook_items_search",
			"Search base (shared) items of a type by name (case-insensitive substring).",
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
		tool("error_reports_list",
			"List actionable open admin-approved page error reports, newest first. Finished/unapproved reports, unanswered AI questions, and serious changes awaiting ADMIN approval are not exposed. A report becomes visible again after an answer or serious-change approval. Use summaryOnly=true with limit=1 for the pre-lock empty-queue probe. Scheduled automation should use compact=true for the post-lock batch; it preserves diagnostic evidence while omitting fixed queue/workflow fields.",
			schema(map[string]any{
				"limit":       intP("Max rows, 1..500 (default 100)"),
				"offset":      intP("Offset for pagination (default 0)"),
				"summaryOnly": boolP("Return only {hasReports}; use with limit=1 before acquiring the automation lease"),
				"compact":     boolP("Return the diagnostic projection used by automation without redundant queue/workflow fields"),
			})),
		tool("error_report_lock_acquire",
			"Atomically acquire the shared error-report automation lease before reading or changing reports. If acquired is false, another run is active and this run must stop. Returns a short-lived opaque leaseId handle; release it in a final cleanup step. Requires MCP write operations to be enabled.",
			schema(map[string]any{
				"ttlMinutes": intP("Lease lifetime, 5..120 minutes (default 45)"),
			})),
		tool("error_report_lock_renew",
			"Extend a still-active error-report automation lease owned by the supplied leaseId. Renew before tests, push, and deploy or whenever expiry is less than 15 minutes away. Requires MCP write operations to be enabled.",
			schema(map[string]any{
				"leaseId":    strP("Opaque handle returned by error_report_lock_acquire"),
				"ttlMinutes": intP("New lease lifetime from now, 5..120 minutes (default 45)"),
			}, "leaseId")),
		tool("error_report_lock_release",
			"Release the shared error-report automation lease. Always call this in the run's final cleanup step, including when no approved reports exist. Requires MCP write operations to be enabled.",
			schema(map[string]any{
				"leaseId": strP("Opaque handle returned by error_report_lock_acquire"),
			}, "leaseId")),
		tool("error_reports_claim",
			"Atomically mark a batch from the current actionable queue as IN_PROGRESS for the active automation lease. Claimed reports disappear from error_reports_list, remain visible to reviewers as 'В работе', and return to OPEN if the lease expires or is released before completion. Call immediately after the post-lock error_reports_list and before reading project context.",
			schema(map[string]any{
				"ids":     map[string]any{"type": "array", "items": map[string]any{"type": "integer"}, "description": "All actionable report ids from the post-lock list, 1..500"},
				"leaseId": strP("Opaque handle returned by error_report_lock_acquire"),
			}, "ids", "leaseId")),
		tool("error_report_title_set",
			"Set a concise diagnostic title after the AI has inspected a claimed report. New reports intentionally have title=null; call this once the symptom is understood. Only the active lease that owns the IN_PROGRESS report can set it.",
			schema(map[string]any{
				"id":      intP("Claimed error report id"),
				"title":   strP("Concise diagnostic title in Russian, 1..160 characters"),
				"leaseId": strP("Opaque handle that owns the IN_PROGRESS report"),
			}, "id", "title", "leaseId")),
		tool("error_report_resolve",
			"Mark one successfully fixed open approved report as finished. Records a concise resolution and optional deployed commit SHA; the report remains visible to reviewers for one hour before automatic archival and is removed from the actionable MCP queue. Call only after successful tests, push, and deploy. Requires MCP write operations to be enabled.",
			schema(map[string]any{
				"id":         intP("Error report id"),
				"resolution": strP("Concise root cause and deployed fix, 1..4000 characters"),
				"commitSha":  strP("Optional deployed Git commit SHA, 7..64 hexadecimal characters"),
				"leaseId":    strP("Lease that owns the IN_PROGRESS report"),
			}, "id", "resolution", "leaseId")),
		tool("error_report_question_create",
			"Ask an admin a question when an approved error report cannot be handled confidently. After this call the report is hidden from error_reports_list until an admin answers. Ask one concrete question that explains exactly which missing fact or decision blocks the fix. Requires MCP write operations to be enabled.",
			schema(map[string]any{
				"id":       intP("Error report id"),
				"question": strP("Concrete question for the administrator, 1..4000 characters"),
				"leaseId":  strP("Lease that owns the IN_PROGRESS report"),
			}, "id", "question", "leaseId")),
		tool("error_report_serious_change_request",
			"Pause an approved report because the proposed fix changes schema, authorization, security, data semantics, infrastructure, or another high-impact area that requires explicit ADMIN approval. The report is hidden from error_reports_list until an ADMIN confirms it in the application. Use a normal question instead when only product context is missing. Requires MCP write operations to be enabled.",
			schema(map[string]any{
				"id":      intP("Error report id"),
				"reason":  strP("Concrete proposed high-impact change, risks, and why ADMIN approval is required, 1..4000 characters"),
				"leaseId": strP("Lease that owns the IN_PROGRESS report"),
			}, "id", "reason", "leaseId")),
		tool("error_report_screenshot",
			"Fetch an attached screenshot for one admin-approved page error report as native MCP image content. kind=element returns the selected-element crop; kind=viewport returns the visible page context. Check hasScreenshot/hasViewportScreenshot first.",
			schema(map[string]any{
				"id":   intP("Error report id"),
				"kind": strP("Optional screenshot kind: element (default) or viewport"),
			}, "id")),
		tool("handbook_item_create",
			"Create a base (shared, user_id=null) item. Use handbook_item_types first to learn the `data` schema for the given typeId.",
			schema(map[string]any{
				"typeId":   intP("Item type id"),
				"name":     strP("Display name (Russian)"),
				"nameEn":   strP("English name"),
				"data":     strP("JSON object string with the item data matching the type's fields schema"),
				"parentId": intP("Parent item id for a variant/sub-entity (subrace -> race item, subclass -> class item). Omit for base items."),
			}, "typeId", "name", "nameEn", "data")),
		tool("handbook_item_update",
			"Update an item by id (admin: works for any owner including base items).",
			schema(map[string]any{
				"id":       intP("Item id"),
				"name":     strP("Display name (Russian)"),
				"nameEn":   strP("English name"),
				"data":     strP("JSON object string with the full item data"),
				"parentId": intP("Parent item id for a variant/sub-entity (subrace -> race item, subclass -> class item). Pass -1 to clear the link; omit to leave it unchanged."),
			}, "id", "name", "data")),
		tool("handbook_item_delete",
			"Delete an item by id (admin: works for any owner including base items).",
			schema(map[string]any{"id": intP("Item id")}, "id")),
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
