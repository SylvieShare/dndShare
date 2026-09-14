package web

import "net/http"

func init() { registerRoutes((*Server).routesSessionStatus) }

func (s *Server) routesSessionStatus(mux *http.ServeMux) {
	mux.HandleFunc("PATCH /api/sessions/{uuid}/status", s.handleUpdateSessionStatus)
}

func validSessionStatus(status string) bool {
	return status == "active" || status == "stopped" || status == "completed"
}

func (s *Server) handleUpdateSessionStatus(w http.ResponseWriter, r *http.Request) {
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
		Status string `json:"status"`
	}
	if err := decodeJSON(r, &body); err != nil || !validSessionStatus(body.Status) {
		badRequest(w, "Неизвестный статус сессии")
		return
	}
	if err := s.store.UpdateSessionStatus(r.Context(), session.ID, body.Status); err != nil {
		serverError(w, err)
		return
	}
	s.publishSessionOverview(session.ID)
	writeJSON(w, http.StatusNoContent, nil)
}
