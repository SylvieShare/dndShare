package web

import (
	"dndshare/internal/store"
	"encoding/json"
	"errors"
	"net/http"
)

func (s *Server) toolMapModelCells(r *http.Request, args map[string]json.RawMessage) (any, error) {
	if err := s.mcpRequireWrite(); err != nil {
		return nil, err
	}
	var changes []store.ModelPlacementCells
	if err := json.Unmarshal(args["models"], &changes); err != nil {
		return nil, errors.New("models must contain placement cell patches")
	}
	if err := s.store.UpdateMapModelPlacementCells(r.Context(), changes); err != nil {
		return nil, err
	}
	return map[string]any{"models": len(changes)}, nil
}
func mapModelCellsToolDefinition() map[string]any {
	cell := mcpObjectSchema(map[string]any{"x": map[string]any{"type": "integer", "minimum": 0}, "y": map[string]any{"type": "integer", "minimum": 0}}, "x", "y")
	return mcpDefinition("map_tile_model_placement_cells_update", "Set logical local grid cells for existing placement points. Compare-and-swap exact expected points and footprint dimensions; identical retries accepted. Does not move physical points or change assets/behaviours. Requires MCP writes.", mcpObjectSchema(map[string]any{"models": map[string]any{"type": "array", "minItems": 1, "maxItems": 1000, "items": mcpObjectSchema(map[string]any{"definitionId": mcpStringProperty("Stable model ID"), "width": map[string]any{"type": "integer"}, "height": map[string]any{"type": "integer"}, "expected": map[string]any{"type": "array", "items": map[string]any{"type": "object"}}, "cells": map[string]any{"type": "array", "items": cell}}, "definitionId", "width", "height", "expected", "cells")}}, "models"))
}
