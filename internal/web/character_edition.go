package web

import (
	"errors"
	"net/http"

	"dndshare/internal/store"
)

func init() { registerRoutes((*Server).routesCharacterEdition) }
func (s *Server) routesCharacterEdition(mux *http.ServeMux) {
	mux.HandleFunc("PUT /api/char/{uuid}/edition", s.handleChangeCharacterEdition)
}

func (s *Server) handleChangeCharacterEdition(w http.ResponseWriter, r *http.Request) {
	userID, ok := mustUser(w, r)
	if !ok {
		return
	}
	var req struct {
		SourceVersionID int64  `json:"sourceVersionId"`
		Version         *int64 `json:"version"`
		Confirmed       bool   `json:"confirmed"`
	}
	if decodeJSON(r, &req) != nil || req.SourceVersionID <= 0 || req.Version == nil || *req.Version < 0 || !req.Confirmed {
		badRequest(w, "Укажите редакцию, версию листа и подтвердите смену")
		return
	}
	character, err := s.store.ChangeCharacterEdition(r.Context(), userID, r.PathValue("uuid"), *req.Version, req.SourceVersionID)
	switch {
	case errors.Is(err, store.ErrNotFound):
		notFound(w, "")
		return
	case errors.Is(err, store.ErrCharacterVersion):
		conflict(w, err.Error())
		return
	case errors.Is(err, store.ErrCharacterEdition):
		badRequest(w, err.Error())
		return
	case err != nil:
		serverError(w, err)
		return
	}
	s.publishCharacterChange(r.Context(), character.ID)
	s.writeCharacterResponse(w, r, character)
}
