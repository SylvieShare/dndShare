package web

import (
	"dndshare/internal/store"
	"net/http"
)

func init() { registerRoutes((*Server).routesSessionSettings) }
func (s *Server) routesSessionSettings(mux *http.ServeMux) {
	mux.HandleFunc("PATCH /api/sessions/{uuid}/settings", s.handleUpdateSessionSetting)
}
func (s *Server) handleUpdateSessionSetting(w http.ResponseWriter, r *http.Request) {
	userID, ok := mustUser(w, r)
	if !ok {
		return
	}
	session, err := s.lookupSession(w, r)
	if err != nil {
		return
	}
	if session.OwnerUserID != userID {
		forbidden(w)
		return
	}
	var body struct {
		Key   string `json:"key"`
		Value *bool  `json:"value"`
	}
	if err := decodeJSON(r, &body); err != nil || !store.ValidSessionSetting(body.Key) || body.Value == nil {
		badRequest(w, "Неизвестная настройка сессии или неверное значение")
		return
	}
	if err := s.store.UpdateSessionSetting(r.Context(), session.ID, body.Key, *body.Value); err != nil {
		serverError(w, err)
		return
	}
	s.publishSessionOverview(session.ID)
	writeJSON(w, http.StatusNoContent, nil)
}
