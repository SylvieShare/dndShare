package web

import (
	"dndshare/internal/store"
	"net/http"
)

func init() { registerRoutes((*Server).routesSessionKarmicDice) }

func (s *Server) routesSessionKarmicDice(mux *http.ServeMux) {
	mux.HandleFunc("POST /api/sessions/{uuid}/d20", s.handleSessionD20)
	mux.HandleFunc("GET /api/sessions/{uuid}/karmic-dice", s.handleSessionKarmicDice)
}

func (s *Server) handleSessionD20(w http.ResponseWriter, r *http.Request) {
	userID, session, ok := s.requireSessionEventAccess(w, r)
	if !ok {
		return
	}
	var req store.SessionD20Request
	if decodeJSON(r, &req) != nil || !isUUID(req.RequestID) || (req.CharUUID != "" && !isUUID(req.CharUUID)) || !store.ValidSessionD20Request(req) {
		badRequest(w, "Некорректные параметры броска d20")
		return
	}
	result, err := s.store.RollSessionD20(r.Context(), session.ID, userID, req)
	if err != nil {
		itemTransferError(w, err)
		return
	}
	if result.Karmic {
		s.publishSessionOverview(session.ID)
	}
	writeJSON(w, http.StatusOK, result)
}

func (s *Server) handleSessionKarmicDice(w http.ResponseWriter, r *http.Request) {
	userID, session, ok := s.requireSessionEventAccess(w, r)
	if !ok {
		return
	}
	if session.OwnerUserID != userID {
		forbidden(w)
		return
	}
	scales, err := s.store.SessionKarmicScales(r.Context(), session.ID)
	if err != nil {
		serverError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"scales": scales})
}
