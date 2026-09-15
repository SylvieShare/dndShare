package store

import _ "embed"

//go:embed schema/123_session_player_visibility.sql
var schemaSessionPlayerVisibilitySQL string

//go:embed schema/124_session_settings_json.sql
var schemaSessionSettingsJSONSQL string
