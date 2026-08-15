package store

import (
	"strings"
	"testing"
)

func TestGraphNodeQueriesStayScopedToTheirSession(t *testing.T) {
	tests := []struct {
		level        string
		membershipIn string
		updateIn     string
	}{
		{level: "chapters", membershipIn: "session_id = $1", updateIn: "session_chapter"},
		{level: "scenes", membershipIn: "JOIN dndshare.session_chapter", updateIn: "session_scene"},
		{level: "blocks", membershipIn: "JOIN dndshare.session_scene", updateIn: "session_scene_item"},
	}
	for _, test := range tests {
		t.Run(test.level, func(t *testing.T) {
			membership, update, ok := graphNodeQueries(test.level)
			if !ok || !strings.Contains(membership, test.membershipIn) || !strings.Contains(update, test.updateIn) {
				t.Fatalf("unexpected graph queries: membership=%q update=%q", membership, update)
			}
		})
	}
	if _, _, ok := graphNodeQueries("edges"); ok {
		t.Fatal("unsupported graph level must not produce SQL")
	}
}
