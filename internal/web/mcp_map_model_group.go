package web

import (
	"encoding/json"
	"errors"
	"net/http"
	"strings"

	"dndshare/internal/battlemap"
)

func (s *Server) toolMapModelGroup(r *http.Request, args map[string]json.RawMessage) (any, error) {
	if err := s.mcpRequireWrite(); err != nil {
		return nil, err
	}
	id, err := argString(args, "definitionId")
	if err != nil {
		return nil, err
	}
	if strings.TrimSpace(id) == "" || len(id) > 512 {
		return nil, errors.New("logical model definitionId required")
	}
	code, err := argString(args, "code")
	if err != nil {
		return nil, err
	}
	expected, err := argString(args, "expectedCode")
	if err != nil {
		return nil, err
	}
	if !battlemap.ValidModelGroupCode(code) || !battlemap.ValidModelGroupCode(expected) {
		return nil, errors.New("valid current and target group codes required")
	}
	code, err = s.store.UpdateMapModelGroup(r.Context(), id, expected, code)
	if err != nil {
		return nil, err
	}
	return map[string]any{"definitionId": id, "code": code}, nil
}
