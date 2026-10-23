package web

import (
	"dndshare/internal/store"
	"encoding/json"
	"errors"
	"net/http"
)

func itemModelTools() []map[string]any {
	return []map[string]any{
		mcpDefinition("item_models_list", "List model bindings for public handbook items; itemId=0 lists all. Default first, then sortOrder and modelId.", mcpObjectSchema(map[string]any{"itemId": mcpIntegerProperty("Public handbook item ID, or 0 for all")}, "itemId")),
		mcpDefinition("item_model_bind", "Attach a registered object model to a public handbook item. Idempotent upsert. default=true atomically replaces the previous default for this item. Requires MCP writes.", mcpObjectSchema(map[string]any{"itemId": mcpIntegerProperty("Public item ID"), "modelId": mcpStringProperty("Registered model UUID"), "default": map[string]any{"type": "boolean"}, "sortOrder": mcpIntegerProperty("Nonnegative ordering within the item")}, "itemId", "modelId", "default", "sortOrder")),
		mcpDefinition("item_model_unbind", "Remove an item/model binding, preserving the model and its files. Requires MCP writes.", mcpObjectSchema(map[string]any{"itemId": mcpIntegerProperty("Public item ID"), "modelId": mcpStringProperty("Registered model UUID")}, "itemId", "modelId")),
	}
}

func (s *Server) toolItemModels(r *http.Request, name string, args map[string]json.RawMessage) (any, error) {
	if name != "item_models_list" {
		if err := s.mcpRequireWrite(); err != nil {
			return nil, err
		}
	}
	var b store.ItemModelBinding
	for key, target := range map[string]any{"itemId": &b.ItemID, "modelId": &b.ModelID, "default": &b.Default, "sortOrder": &b.SortOrder} {
		if raw, ok := args[key]; ok {
			if err := json.Unmarshal(raw, target); err != nil {
				return nil, errors.New("invalid item model binding")
			}
		}
	}
	if b.ItemID < 0 || (name != "item_models_list" && (b.ItemID == 0 || !isUUID(b.ModelID) || b.SortOrder < 0)) {
		return nil, errors.New("valid itemId, modelId and sortOrder required")
	}
	if name == "item_models_list" {
		return s.store.ListItemModels(r.Context(), b.ItemID)
	}
	if name == "item_model_unbind" {
		return map[string]bool{"removed": true}, s.store.UnbindItemModel(r.Context(), b.ItemID, b.ModelID)
	}
	if err := s.store.BindItemModel(r.Context(), b); err != nil {
		return nil, err
	}
	return b, nil
}
