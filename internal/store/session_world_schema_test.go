package store

import (
	"strings"
	"testing"
)

func TestSessionWorldSchemaUsesTreeAndExplicitAssociations(t *testing.T) {
	for _, fragment := range []string{
		"CREATE TABLE IF NOT EXISTS dndshare.session_location",
		"parent_location_id int8 NULL REFERENCES dndshare.session_location(id) ON DELETE RESTRICT",
		"session_location_not_own_parent",
		"idx_session_location_session_order",
		"CREATE TABLE IF NOT EXISTS dndshare.session_npc",
		"CREATE TABLE IF NOT EXISTS dndshare.session_scene_location",
		"CREATE TABLE IF NOT EXISTS dndshare.session_npc_location",
		"CREATE TABLE IF NOT EXISTS dndshare.session_npc_scene",
		"ON DELETE CASCADE",
	} {
		if !strings.Contains(schemaSessionWorldSQL, fragment) {
			t.Fatalf("session world schema must contain %q", fragment)
		}
	}
	if strings.Contains(schemaSessionWorldSQL, "session_location_edge") {
		t.Fatal("locations must remain a tree without graph edges")
	}
}

func TestSessionWorldSchemaRunsAfterSessionTables(t *testing.T) {
	if schemaParts[len(schemaParts)-1].name != "session-world" {
		t.Fatalf("last schema part = %q, want session-world", schemaParts[len(schemaParts)-1].name)
	}
}

func TestUniqueWorldIDsDropsInvalidAndDuplicateValues(t *testing.T) {
	got := uniqueWorldIDs([]int64{4, 0, 4, -1, 9, 9, 2})
	want := []int64{4, 9, 2}
	if len(got) != len(want) {
		t.Fatalf("uniqueWorldIDs() = %v, want %v", got, want)
	}
	for index := range want {
		if got[index] != want[index] {
			t.Fatalf("uniqueWorldIDs() = %v, want %v", got, want)
		}
	}
}
