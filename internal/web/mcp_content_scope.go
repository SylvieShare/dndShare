package web

import (
	"dndshare/internal/store"
	"encoding/json"
)

func mcpContentScope(args map[string]json.RawMessage) (store.ContentScope, error) {
	scope := store.ContentScope{}
	id, err := argInt64Opt(args, "sourceVersionId")
	if err != nil {
		return scope, err
	}
	scope.SourceVersionID = id
	if raw, ok := rawArg(args, "contentSourceIds"); ok {
		scope.RestrictToIDs = true
		if err = json.Unmarshal(raw, &scope.IDs); err != nil {
			return scope, err
		}
	}
	if raw, ok := rawArg(args, "allowLegacy"); ok {
		if err = json.Unmarshal(raw, &scope.AllowLegacy); err != nil {
			return scope, err
		}
	}
	return scope, nil
}
