package web

import (
	"dndshare/internal/config"
	"encoding/json"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestModelGroupingRequiresCompleteCompareAndSwapAndWrites(t *testing.T) {
	r := httptest.NewRequest("POST", "/mcp", nil)
	s := &Server{cfg: config.Config{MCPWriteEnabled: false}}
	if _, err := s.dispatchTool(r, "map_tile_model_grouping_update", nil); err == nil {
		t.Fatal("missing write guard")
	}
	s.cfg.MCPWriteEnabled = true
	for _, body := range []string{`{}`, `{"models":[]}`, `{"models":[{}]}`, `{"models":[{"definitionId":"LC-001","expectedCode":"LC-wall","code":"LC-walls","variantCode":"LC-wall"}]}`, `{"models":[{"definitionId":"LC-001","expectedCode":"LC-wall","expectedVariantCode":"","code":"LC-walls","variantCode":"UD-wall"}]}`} {
		var args map[string]json.RawMessage
		if err := json.Unmarshal([]byte(body), &args); err != nil {
			t.Fatal(err)
		}
		if _, err := s.dispatchTool(r, "map_tile_model_grouping_update", args); err == nil {
			t.Fatal("invalid grouping accepted", body)
		}
	}
}

func TestMapModelEditRequiresExplicitVariantCodeBeforeStorage(t *testing.T) {
	r := httptest.NewRequest("PUT", "/api/maps/models/00000000-0000-4000-8000-000000000001", strings.NewReader(`{"id":"LC-001","uuid":"00000000-0000-4000-8000-000000000001","code":"LC-wall"}`))
	r.SetPathValue("modelId", "00000000-0000-4000-8000-000000000001")
	w := httptest.NewRecorder()
	(&Server{}).handleEditMapModel(w, r)
	if w.Code != 400 {
		t.Fatal("incomplete metadata reached storage", w.Code)
	}
}
