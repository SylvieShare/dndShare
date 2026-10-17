package store

import (
	"strings"
	"testing"
)

func TestSessionEventActorItemSchema(t *testing.T) {
	var schema strings.Builder
	for _, part := range schemaParts {
		schema.WriteString(part.sql)
	}
	for _, fragment := range []string{
		"actor_item_id bigint",
		"FOREIGN KEY (actor_item_id) REFERENCES dndshare.item(id) ON DELETE SET NULL",
		"idx_session_event_actor_item",
	} {
		if !strings.Contains(schema.String(), fragment) {
			t.Fatalf("current session event structure must contain %q", fragment)
		}
	}
}
