package web

import (
	"dndshare/internal/config"
	"encoding/json"
	"net/http/httptest"
	"testing"
)

func TestModelCatalogueRejectsIncompleteNamesAndRequiresWrites(t *testing.T) {
	s := &Server{cfg: config.Config{MCPWriteEnabled: false}}
	r := httptest.NewRequest("POST", "/mcp", nil)
	if _, err := s.dispatchTool(r, "map_tile_model_catalogue_update", nil); err == nil {
		t.Fatal("missing write guard")
	}
	s.cfg.MCPWriteEnabled = true
	for _, body := range []string{`{}`, `{"models":[{}]}`, `{"models":[{"definitionId":"LC-001","name":"Стена","nameEn":"Wall","category":"all","code":"LC-walls","expected":{"code":"LC-walls"}}]}`, `{"groups":[{"collection":"lost-cave","code":"LC-walls","name":"Стены"}]}`} {
		var args map[string]json.RawMessage
		if err := json.Unmarshal([]byte(body), &args); err != nil {
			t.Fatal(err)
		}
		if _, err := s.dispatchTool(r, "map_tile_model_catalogue_update", args); err == nil {
			t.Fatal("incomplete catalogue accepted", body)
		}
	}
}
