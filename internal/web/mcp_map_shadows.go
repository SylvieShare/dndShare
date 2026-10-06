package web

import (
	"encoding/json"
	"errors"
	"net/http"

	"dndshare/internal/battlemap"
)

// Omitted shadow assets inherit a compatible shape's shadow, or explicitly use
// the newly uploaded LOD. Every stored model has a resolved shadow resource.
func (s *Server) assignMapShadow(r *http.Request, model *battlemap.Model) error {
	if _, ok := model.Assets["shadow"]; ok || len(model.Assets) != 4 {
		return nil
	}
	model.Assets["shadow"] = model.Assets["lod"]
	models, err := s.store.ListMapModels(r.Context())
	if err != nil {
		return err
	}
	version := 0
	for _, old := range models {
		if old.ID == model.ID {
			model.Assets["shadow"] = old.Assets["shadow"]
			return nil
		}
		if old.Version > version && battlemap.VisualRevision(old, *model) {
			version = old.Version
			model.Assets["shadow"] = old.Assets["shadow"]
		}
	}
	return nil
}

func (s *Server) toolRegisterMapShadow(r *http.Request, args map[string]json.RawMessage) (any, error) {
	if err := s.mcpRequireWrite(); err != nil {
		return nil, err
	}
	id, err := argString(args, "id")
	if err != nil || !isUUID(id) {
		return nil, errors.New("model UUID required")
	}
	lodSHA, err := argString(args, "expectedLodSHA256")
	if err != nil || !mapSHA.MatchString(lodSHA) {
		return nil, errors.New("expected LOD SHA-256 required")
	}
	var asset battlemap.ModelAsset
	if err = json.Unmarshal(args["asset"], &asset); err != nil {
		return nil, errors.New("shadow asset metadata required")
	}
	input := map[string]json.RawMessage{}
	for key, value := range map[string]any{"kind": "shadow", "fileName": asset.FileName, "size": asset.Size, "sha256": asset.SHA256} {
		input[key], _ = json.Marshal(value)
	}
	_, expected, err := parseMapAsset(input)
	if err != nil {
		return nil, err
	}
	if expected != asset {
		return nil, errors.New("shadow metadata differs from upload result")
	}
	if err = s.verifyMapAsset(r, asset.Key, asset); err != nil {
		return nil, err
	}
	revisionID, err := newUUID()
	if err != nil {
		return nil, err
	}
	return s.store.ReviseMapModelShadow(r.Context(), id, lodSHA, revisionID, asset)
}
