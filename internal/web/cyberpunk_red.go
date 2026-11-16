package web

import (
	"dndshare/internal/cyberpunkred"
	"encoding/json"
	"net/http"
)

func init() { registerRoutes((*Server).routesCyberpunkRed) }
func (s *Server) routesCyberpunkRed(mux *http.ServeMux) {
	mux.HandleFunc("POST /api/char/{uuid}/red-roll", s.handleRedRoll)
	mux.HandleFunc("GET /api/cyberpunk-red/catalogue", func(w http.ResponseWriter, r *http.Request) {
		var user *int64
		if id, ok := optionalUser(r); ok {
			user = &id
		}
		items, err := s.store.RedCatalogue(r.Context(), user)
		if err != nil {
			serverError(w, err)
			return
		}
		core, err := cyberpunkred.Core()
		if err != nil {
			serverError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"items": nonNil(items), "revision": core.Revision, "groups": core.Groups})
	})
}

func (s *Server) handleRedRoll(w http.ResponseWriter, r *http.Request) {
	user, c, ok := s.loadCharWritable(w, r)
	if !ok {
		return
	}
	var req cyberpunkred.RollRequest
	if decodeJSON(r, &req) != nil || !isUUID(req.ActionID) || (req.SessionUUID != "" && !isUUID(req.SessionUUID)) {
		badRequest(w, "Некорректный запрос броска RED")
		return
	}
	result, err := s.store.RollRedCharacter(r.Context(), user, c.ID, req)
	if err != nil {
		itemTransferError(w, err)
		return
	}
	s.publishCharacterChange(r.Context(), c.ID)
	if req.SessionUUID != "" {
		if session, err := s.store.GetGameSessionByUUID(r.Context(), req.SessionUUID); err == nil {
			s.publishSessionOverview(session.ID)
			s.publishSessionJournal(session.ID)
		}
	}
	writeJSON(w, http.StatusOK, result)
}

func (s *Server) toolRedInstall(r *http.Request, args map[string]json.RawMessage) (any, error) {
	if err := s.mcpRequireWrite(); err != nil {
		return nil, err
	}
	apply := false
	if raw := args["apply"]; len(raw) > 0 {
		if err := json.Unmarshal(raw, &apply); err != nil {
			return nil, err
		}
	}
	hash := cyberpunkred.CoreHash()
	if apply {
		var err error
		hash, err = argString(args, "expectedHash")
		if err != nil {
			return nil, err
		}
	}
	return s.store.InstallRedCatalogue(r.Context(), hash, apply)
}
