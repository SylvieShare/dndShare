package web

import (
	"dndshare/internal/battlemap"
	"encoding/json"
	"errors"
	"net/http"
	"strings"
)

func (s *Server) toolMapModelBehaviour(r *http.Request, name string, args map[string]json.RawMessage) (any, error) {
	if name == "map_tile_model_behaviour_update" {
		if err := s.mcpRequireWrite(); err != nil {
			return nil, err
		}
	}
	id, err := argString(args, "definitionId")
	if err != nil {
		return nil, err
	}
	if strings.TrimSpace(id) == "" || len(id) > 512 {
		return nil, errors.New("logical model definitionId required")
	}
	var b battlemap.ModelBehaviour
	if name == "map_tile_model_behaviour_update" {
		if err = json.Unmarshal(args["behaviour"], &b); err != nil {
			return nil, errors.New("behaviour must contain revision, defaultLights and transitions")
		}
		if err = battlemap.ValidateModelBehaviour(b); err != nil {
			return nil, err
		}
		b, err = s.store.UpdateMapModelBehaviour(r.Context(), id, b)
	} else {
		b, err = s.store.GetMapModelBehaviour(r.Context(), id)
	}
	if err != nil {
		return nil, err
	}
	return map[string]any{"definitionId": id, "behaviour": b}, nil
}
