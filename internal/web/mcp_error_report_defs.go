package web

func mcpErrorReportDefs() []map[string]any {
	return []map[string]any{
		mcpDefinition("error_report_phase_set",
			"Record elapsed work time for the claimed report. Start analysis immediately before diagnosis, fix before edits, test before tests and acceptance, build before dependency installation, compilation, packaging and signing, deploy before publication and rollout verification. Prepare the build separately from tests of its immutable output, then switch back to test for acceptance. Repeat phases when needed; their durations accumulate. Use pause before unrelated work or waiting for a person. Requires the active owning lease. Same-phase retries preserve the timer. Resolve, questions, release and expiry stop timing automatically. Never estimate historical durations.",
			mcpObjectSchema(map[string]any{
				"id":      mcpIntegerProperty("Claimed report id"),
				"phase":   map[string]any{"type": "string", "enum": []string{"analysis", "fix", "test", "build", "deploy", "pause"}},
				"leaseId": mcpStringProperty("Lease that owns this report"),
			}, "id", "phase", "leaseId")),
		mcpDefinition("error_report_get", "Read the current approved report by ID, including claimed or finished reports, messages and screenshot flags. Unapproved reports are not exposed.", mcpObjectSchema(map[string]any{"id": mcpIntegerProperty("Report ID")}, "id")),
		mcpDefinition("error_reports_list",
			"List actionable open admin-approved page error reports, newest first. Finished/unapproved reports, unanswered AI questions, and serious changes awaiting ADMIN approval are not exposed. A report becomes visible again after an answer or serious-change approval. Use summaryOnly=true with limit=1 for the pre-lock empty-queue probe. Scheduled automation should use compact=true for the post-lock batch; it returns {ids: number[], reports: [...]}, preserving diagnostic evidence while omitting fixed queue/workflow fields.",
			mcpObjectSchema(map[string]any{
				"limit":       mcpIntegerProperty("Max rows, 1..500 (default 100)"),
				"offset":      mcpIntegerProperty("Offset for pagination (default 0)"),
				"summaryOnly": mcpBooleanProperty("Return only {hasReports}; use with limit=1 before acquiring the automation lease"),
				"compact":     mcpBooleanProperty("Return the diagnostic projection used by automation without redundant queue/workflow fields"),
			})),
		mcpDefinition("error_report_lock_acquire",
			"Atomically acquire the shared error-report automation lease before reading or changing reports. If acquired is false, another run is active and this run must stop. Returns a short-lived opaque leaseId handle; release it in a final cleanup step. Requires MCP write operations to be enabled.",
			mcpObjectSchema(map[string]any{
				"ttlMinutes": mcpIntegerProperty("Lease lifetime, 5..120 minutes (default 45)"),
			})),
		mcpDefinition("error_report_lock_renew",
			"Extend a still-active error-report automation lease owned by the supplied leaseId. Renew before tests, push, and deploy or whenever expiry is less than 15 minutes away. Requires MCP write operations to be enabled.",
			mcpObjectSchema(map[string]any{
				"leaseId":    mcpStringProperty("Opaque handle returned by error_report_lock_acquire"),
				"ttlMinutes": mcpIntegerProperty("New lease lifetime from now, 5..120 minutes (default 45)"),
			}, "leaseId")),
		mcpDefinition("error_report_lock_release",
			"Release the shared error-report automation lease. Always call this in the run's final cleanup step, including when no approved reports exist. Requires MCP write operations to be enabled.",
			mcpObjectSchema(map[string]any{
				"leaseId": mcpStringProperty("Opaque handle returned by error_report_lock_acquire"),
			}, "leaseId")),
		mcpDefinition("error_reports_claim",
			"Atomically mark a batch from the current actionable queue as IN_PROGRESS for the active automation lease. Claimed reports disappear from error_reports_list, remain visible to reviewers as 'В работе', and return to OPEN if the lease expires or is released before completion. Call immediately after the post-lock error_reports_list and before reading project context.",
			mcpObjectSchema(map[string]any{
				"ids":     map[string]any{"type": "array", "items": map[string]any{"type": "integer"}, "description": "All actionable report ids from the post-lock list, 1..500"},
				"leaseId": mcpStringProperty("Opaque handle returned by error_report_lock_acquire"),
			}, "ids", "leaseId")),
		mcpDefinition("error_report_title_set",
			"Set a concise diagnostic title after the AI has inspected a claimed report. New reports intentionally have title=null; call this once the symptom is understood. Only the active lease that owns the IN_PROGRESS report can set it.",
			mcpObjectSchema(map[string]any{
				"id":      mcpIntegerProperty("Claimed error report id"),
				"title":   mcpStringProperty("Concise diagnostic title in Russian, 1..160 characters"),
				"leaseId": mcpStringProperty("Opaque handle that owns the IN_PROGRESS report"),
			}, "id", "title", "leaseId")),
		mcpDefinition("error_report_resolve",
			"Mark one successfully fixed open approved report as finished. Records a concise resolution and optional deployed commit SHA; the report remains visible to reviewers for one hour before automatic archival and is removed from the actionable MCP queue. Call only after successful tests, push, and deploy. Requires MCP write operations to be enabled.",
			mcpObjectSchema(map[string]any{
				"id":         mcpIntegerProperty("Error report id"),
				"resolution": mcpStringProperty("Concise root cause and deployed fix, 1..4000 characters"),
				"commitSha":  mcpStringProperty("Optional deployed Git commit SHA, 7..64 hexadecimal characters"),
				"leaseId":    mcpStringProperty("Lease that owns the IN_PROGRESS report"),
			}, "id", "resolution", "leaseId")),
		mcpDefinition("error_report_question_create",
			"Ask an admin a question when an approved error report cannot be handled confidently. After this call the report is hidden from error_reports_list until an admin answers. Ask one concrete question that explains exactly which missing fact or decision blocks the fix. Requires MCP write operations to be enabled.",
			mcpObjectSchema(map[string]any{
				"id":       mcpIntegerProperty("Error report id"),
				"question": mcpStringProperty("Concrete question for the administrator, 1..4000 characters"),
				"leaseId":  mcpStringProperty("Lease that owns the IN_PROGRESS report"),
			}, "id", "question", "leaseId")),
		mcpDefinition("error_report_serious_change_request",
			"Pause an approved report because the proposed fix changes schema, authorization, security, data semantics, infrastructure, or another high-impact area that requires explicit ADMIN approval. The report is hidden from error_reports_list until an ADMIN confirms it in the application. Use a normal question instead when only product context is missing. Requires MCP write operations to be enabled.",
			mcpObjectSchema(map[string]any{
				"id":      mcpIntegerProperty("Error report id"),
				"reason":  mcpStringProperty("Concrete proposed high-impact change, risks, and why ADMIN approval is required, 1..4000 characters"),
				"leaseId": mcpStringProperty("Lease that owns the IN_PROGRESS report"),
			}, "id", "reason", "leaseId")),
		mcpDefinition("error_report_screenshot",
			"Fetch an attached screenshot for one admin-approved page error report as native MCP image content. kind=element returns the selected-element crop; kind=viewport returns the visible page context. Check hasScreenshot/hasViewportScreenshot first.",
			mcpObjectSchema(map[string]any{
				"id":   mcpIntegerProperty("Error report id"),
				"kind": mcpStringProperty("Optional screenshot kind: element (default) or viewport"),
			}, "id")),
	}
}
