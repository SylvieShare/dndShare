package store

import _ "embed"

//go:embed schema/108_item_automation.sql
var schemaItemAutomationSQL string

//go:embed schema/110_effect_source_filter.sql
var schemaEffectSourceFilterSQL string

//go:embed schema/109_magic_item_automation_audit.sql
var schemaMagicItemAutomationAuditSQL string
