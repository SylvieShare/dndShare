package web

import (
	"context"
	"dndshare/internal/config"
	"encoding/json"
	"testing"
)

func TestReuseCoverWriteGuardAndIDs(t *testing.T) {
	for _, tc := range []struct {
		write bool
		args  map[string]json.RawMessage
	}{
		{false, map[string]json.RawMessage{"itemId": json.RawMessage(`1`), "sourceItemId": json.RawMessage(`2`)}},
		{true, map[string]json.RawMessage{"itemId": json.RawMessage(`0`), "sourceItemId": json.RawMessage(`2`)}},
		{true, map[string]json.RawMessage{"itemId": json.RawMessage(`1`), "sourceItemId": json.RawMessage(`-1`)}},
		{true, map[string]json.RawMessage{"itemId": json.RawMessage(`1`)}},
	} {
		s := &Server{cfg: config.Config{MCPWriteEnabled: tc.write}}
		if _, err := s.toolReuseSystemCover(context.Background(), tc.args); err == nil {
			t.Fatal("invalid request accepted")
		}
	}
}
