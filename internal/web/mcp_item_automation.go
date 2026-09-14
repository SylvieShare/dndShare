package web

import (
	"dndshare/internal/store"
	"encoding/json"
)

func mcpItemMetadata(args map[string]json.RawMessage) (store.ItemMetadataPatch, error) {
	var patch store.ItemMetadataPatch
	raw, err := json.Marshal(args)
	if err != nil {
		return patch, err
	}
	if err = json.Unmarshal(raw, &patch); err != nil {
		return patch, err
	}
	return patch, patch.Validate()
}
