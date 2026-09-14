package store

import _ "embed"

//go:embed schema/119_potion_use_requests.sql
var schemaPotionUseRequestsSQL string

//go:embed schema/120_potion_applications.sql
var schemaPotionApplicationsSQL string

//go:embed schema/121_application_targets.sql
var schemaApplicationTargetsSQL string
