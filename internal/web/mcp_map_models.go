package web

import (
	"encoding/json"
	"errors"
	"net/http"

	"dndshare/internal/battlemap"
)

func (s *Server) toolMapModels(r *http.Request, name string, args map[string]json.RawMessage) (any, error) {
	switch name {
	case "map_tile_models_list":
		collection, err := argStringOpt(args, "collection")
		if err != nil {
			return nil, err
		}
		models, err := s.store.ListMapModels(r.Context())
		if err != nil {
			return nil, err
		}
		if collection != nil {
			filtered := []battlemap.Model{}
			for _, m := range models {
				if m.Collection == *collection {
					filtered = append(filtered, m)
				}
			}
			models = filtered
		}
		return models, nil
	case "map_tile_model_get":
		id, err := argString(args, "id")
		if err != nil {
			return nil, err
		}
		if !isUUID(id) {
			return nil, errors.New("model UUID required")
		}
		return s.store.GetMapModel(r.Context(), id)
	case "map_tile_model_register_shadow":
		return s.toolRegisterMapShadow(r, args)
	case "map_tile_model_register":
		if err := s.mcpRequireWrite(); err != nil {
			return nil, err
		}
		var model battlemap.Model
		if err := json.Unmarshal(args["model"], &model); err != nil {
			return nil, errors.New("model must be a complete JSON object")
		}
		if err := s.assignMapShadow(r, &model); err != nil {
			return nil, err
		}
		if err := validateMapModel(model); err != nil {
			return nil, err
		}
		for kind, asset := range model.Assets {
			args := map[string]json.RawMessage{}
			for key, value := range map[string]any{"kind": kind, "fileName": asset.FileName, "size": asset.Size, "sha256": asset.SHA256} {
				args[key], _ = json.Marshal(value)
			}
			_, expected, err := parseMapAsset(args)
			if err != nil {
				return nil, err
			}
			if expected != asset {
				return nil, errors.New("asset metadata differs from upload result")
			}
			if err = s.verifyMapAsset(r, asset.Key, asset); err != nil {
				return nil, err
			}
		}
		return s.store.RegisterMapModel(r.Context(), model)
	}
	return nil, errors.New("unknown map model tool")
}
