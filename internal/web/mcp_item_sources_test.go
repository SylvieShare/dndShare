package web

import (
	"context"
	"dndshare/internal/config"
	"encoding/json"
	"strings"
	"testing"
)

func TestMCPItemSourcesRejectsWritesAndInvalidArguments(t *testing.T) {
	for _, tc := range []struct {
		name  string
		write bool
		args  map[string]json.RawMessage
		want  string
	}{
		{"disabled", false, nil, "disabled"},
		{"missing id", true, nil, "id"},
		{"missing sources", true, map[string]json.RawMessage{"id": json.RawMessage(`1`)}, "contentSourceIds"},
		{"wrong sources", true, map[string]json.RawMessage{"id": json.RawMessage(`1`), "contentSourceIds": json.RawMessage(`["one"]`)}, "array of integers"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			s := &Server{cfg: config.Config{MCPWriteEnabled: tc.write}}
			_, err := s.toolItemSetContentSources(context.Background(), tc.args)
			if err == nil || !strings.Contains(err.Error(), tc.want) {
				t.Fatalf("wanted %q, got %v", tc.want, err)
			}
		})
	}
}
