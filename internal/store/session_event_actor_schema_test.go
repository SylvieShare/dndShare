package store

import (
	"os"
	"strings"
	"testing"
)

func TestSessionEventActorItemSchema(t *testing.T) {
	schema, err := os.ReadFile("schema/67_session_event_actor_item.sql")
	if err != nil {
		t.Fatal(err)
	}
	for _, fragment := range []string{
		"ADD COLUMN IF NOT EXISTS actor_item_id",
		"REFERENCES dndshare.item(id) ON DELETE SET NULL",
		"idx_session_event_actor_item",
	} {
		if !strings.Contains(string(schema), fragment) {
			t.Fatalf("session event actor migration must contain %q", fragment)
		}
	}
}
