package store

import _ "embed"

//go:embed schema/180_map_lighting.sql
var schemaMapLightingSQL string

//go:embed schema/181_map_lighting_mode.sql
var schemaMapLightingModeSQL string
