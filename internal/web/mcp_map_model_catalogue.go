package web

import (
	"dndshare/internal/store"
	"encoding/json"
	"errors"
	"net/http"
)

func (s *Server) toolMapModelCatalogue(r *http.Request, args map[string]json.RawMessage) (any, error) {
	if err := s.mcpRequireWrite(); err != nil {
		return nil, err
	}
	var models []store.ModelCatalogueChange
	var groups []store.ModelGroupNames
	if raw, ok := args["models"]; ok {
		if err := json.Unmarshal(raw, &models); err != nil {
			return nil, errors.New("invalid catalogue models")
		}
	}
	if raw, ok := args["groups"]; ok {
		if err := json.Unmarshal(raw, &groups); err != nil {
			return nil, errors.New("invalid catalogue groups")
		}
	}
	if err := s.store.UpdateMapModelCatalogue(r.Context(), models, groups); err != nil {
		return nil, err
	}
	return map[string]any{"models": len(models), "groups": len(groups)}, nil
}

func mapModelCatalogueToolDefinition() map[string]any {
	value := map[string]any{"name": mcpStringProperty("Russian display name"), "nameEn": mcpStringProperty("English name"), "category": mcpStringProperty("floor/wall/water/railway/stairs/frame/bridge/passage/column/object"), "code": mcpStringProperty("Unchanged section code")}
	expected := mcpObjectSchema(value, "name", "nameEn", "category", "code")
	model := map[string]any{"definitionId": mcpStringProperty("Logical model ID"), "expected": expected}
	for key, v := range value {
		model[key] = v
	}
	group := map[string]any{"collection": mcpStringProperty("Collection ID"), "code": mcpStringProperty("Section code"), "name": value["name"], "nameEn": value["nameEn"], "expectedName": mcpStringProperty("Fresh Russian group name; empty when not yet registered"), "expectedNameEn": mcpStringProperty("Fresh English group name; empty when not yet registered")}
	return mcpDefinition("map_tile_model_catalogue_update", "Atomically patch bilingual model and group names and catalogue categories, up to1000 each. Uses expected values, accepts identical retries. Preserves all geometry, IDs, variantCode, occupancy, assets, lights and transitions. Requires MCP writes.", mcpObjectSchema(map[string]any{
		"models": map[string]any{"type": "array", "maxItems": 1000, "items": mcpObjectSchema(model, "definitionId", "expected", "name", "nameEn", "category", "code")},
		"groups": map[string]any{"type": "array", "maxItems": 1000, "items": mcpObjectSchema(group, "collection", "code", "name", "nameEn", "expectedName", "expectedNameEn")},
	}))
}
