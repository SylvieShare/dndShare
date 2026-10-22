package web

import (
	"dndshare/internal/battlemap"
	"dndshare/internal/config"
	"encoding/json"
	"net/http/httptest"
	"testing"
)

func TestPlacementPointCellRequiredAndBounded(t *testing.T) {
	model := battlemap.InitialCatalogue()[0]
	model.PlacementPoints = []battlemap.PlacementPoint{{X: .5, Y: .5, Elevation: model.SurfaceHeight, Cell: &battlemap.GridCell{X: 0, Y: 0}}}
	if err := validateMapModel(model); err != nil {
		t.Fatal(err)
	}
	for _, cell := range []*battlemap.GridCell{nil, {X: -1}, {X: model.Width}, {Y: model.Height}} {
		model.PlacementPoints[0].Cell = cell
		if validateMapModel(model) == nil {
			t.Fatalf("accepted cell %+v", cell)
		}
	}
}
func TestPlacementCellToolChecksWriteFlagAndArguments(t *testing.T) {
	r := httptest.NewRequest("POST", "/mcp", nil)
	s := &Server{cfg: config.Config{MCPWriteEnabled: false}}
	if _, err := s.dispatchTool(r, "map_tile_model_placement_cells_update", nil); err == nil {
		t.Fatal("allowed disabled writes")
	}
	s.cfg.MCPWriteEnabled = true
	if _, err := s.dispatchTool(r, "map_tile_model_placement_cells_update", map[string]json.RawMessage{}); err == nil {
		t.Fatal("allowed missing patch")
	}
}
