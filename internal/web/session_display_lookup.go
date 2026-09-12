package web

import (
	"errors"
	"net/http"

	"dndshare/internal/store"
)

func (s *Server) publicDisplaySession(w http.ResponseWriter, r *http.Request) (store.GameSession, bool) {
	session, err := s.store.GetGameSessionByDisplayCode(r.Context(), r.PathValue("code"))
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			notFound(w, "")
		} else {
			serverError(w, err)
		}
		return store.GameSession{}, false
	}
	return session, true
}
