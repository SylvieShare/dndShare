package web

import (
	"dndshare/internal/store"
	"encoding/json"
)

func mcpItemAutomation(args map[string]json.RawMessage) (store.ItemAutomationPatch, error) {
	var patch store.ItemAutomationPatch
	raw, err := json.Marshal(args)
	if err != nil {
		return patch, err
	}
	if err = json.Unmarshal(raw, &patch); err != nil {
		return patch, err
	}
	return patch, patch.Validate()
}
