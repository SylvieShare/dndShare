package web

import (
	"dndshare/internal/battlemap"
	"dndshare/internal/store"
	"encoding/json"
	"errors"
	"net/http"
	"strings"
)

func (s *Server) toolMapModelGrouping(r *http.Request, args map[string]json.RawMessage) (any, error) {
	if err := s.mcpRequireWrite(); err != nil {
		return nil, err
	}
	var raw []struct {
		store.ModelGroupingChange
		ExpectedVariant *string `json:"expectedVariantCode"`
		Variant         *string `json:"variantCode"`
	}
	if err := json.Unmarshal(args["models"], &raw); err != nil || len(raw) == 0 || len(raw) > 1000 {
		return nil, errors.New("expected 1..1000 models")
	}
	changes := make([]store.ModelGroupingChange, 0, len(raw))
	seen := map[string]bool{}
	for _, entry := range raw {
		c := entry.ModelGroupingChange
		if entry.ExpectedVariant == nil || entry.Variant == nil || strings.TrimSpace(c.DefinitionID) == "" || len(c.DefinitionID) > 512 || seen[c.DefinitionID] || !battlemap.ValidModelGroupCode(c.Code) || !battlemap.ValidModelGroupCode(c.ExpectedCode) || !battlemap.ValidModelVariantCode(c.Code, *entry.Variant) || !battlemap.ValidModelVariantCode(c.ExpectedCode, *entry.ExpectedVariant) {
			return nil, errors.New("complete valid grouping and expected codes required")
		}
		c.ExpectedVariantCode, c.VariantCode = *entry.ExpectedVariant, *entry.Variant
		changes = append(changes, c)
		seen[c.DefinitionID] = true
	}
	if err := s.store.UpdateMapModelGrouping(r.Context(), changes); err != nil {
		return nil, err
	}
	return map[string]any{"updated": len(changes)}, nil
}
