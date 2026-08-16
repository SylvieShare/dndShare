package store

import (
	"strings"
	"testing"
)

func TestSessionPresentationSchemaKeepsScopedMaterialsAndOneLiveState(t *testing.T) {
	for _, fragment := range []string{
		"CREATE TABLE IF NOT EXISTS dndshare.session_material",
		"scope IN ('session', 'chapter', 'scene')",
		"session_material_context_check",
		"presentation_material_id",
		"presentation_track_id",
		"presentation_crossfade_sec",
		"ADD COLUMN IF NOT EXISTS material_id",
		"CREATE TABLE IF NOT EXISTS dndshare.session_presentation_state",
		"mode IN ('idle', 'material', 'scene', 'combat')",
		"effect IN ('none', 'rain', 'fog', 'embers', 'snow', 'storm')",
		"transition IN ('cut', 'fade')",
	} {
		if !strings.Contains(schemaSessionPresentationSQL, fragment) {
			t.Fatalf("session presentation schema must contain %q", fragment)
		}
	}
}
