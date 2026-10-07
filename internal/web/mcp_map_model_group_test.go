package web

import (
	"encoding/json"
	"net/http/httptest"
	"strings"
	"testing"

	"dndshare/internal/config"
)

func TestMapModelGroupRejectsInvalidRequestsBeforeStorage(t *testing.T) {
	r := httptest.NewRequest("POST", "/mcp", nil)
	s := &Server{cfg: config.Config{MCPWriteEnabled: false}}
	if _, err := s.dispatchTool(r, "map_tile_model_group_update", nil); err == nil || !strings.Contains(err.Error(), "disabled") {
		t.Fatal("write guard", err)
	}
	s.cfg.MCPWriteEnabled = true
	for _, input := range []string{
		`{}`,
		`{"definitionId":" ","code":"MH-campfire","expectedCode":"MH-lit-campfire"}`,
		`{"definitionId":"MH-031","code":"MH-campfire"}`,
		`{"definitionId":"MH-031","code":"campfire","expectedCode":"MH-lit-campfire"}`,
		`{"definitionId":"MH-031","code":"MH-Campfire","expectedCode":"MH-lit-campfire"}`,
		`{"definitionId":"MH-031","code":"MH-campfire","expectedCode":""}`,
	} {
		var args map[string]json.RawMessage
		if err := json.Unmarshal([]byte(input), &args); err != nil {
			t.Fatal(err)
		}
		if _, err := s.dispatchTool(r, "map_tile_model_group_update", args); err == nil {
			t.Fatal("accepted invalid request", input)
		}
	}
}
