package web

import (
	"dndshare/internal/store"
	"net/http"
	"strconv"
)

func init() { registerRoutes((*Server).routesSessionAttackTargets) }

func (s *Server) routesSessionAttackTargets(mux *http.ServeMux) {
	mux.HandleFunc("PUT /api/sessions/{uuid}/events/{eventId}/attack-targets", s.handleSessionAttackTargets)
}

func (s *Server) handleSessionAttackTargets(w http.ResponseWriter, r *http.Request) {
	uid, session, ok := s.requireSessionEventAccess(w, r)
	if !ok {
		return
	}
	if session.OwnerUserID != uid {
		forbidden(w)
		return
	}
	id, err := strconv.ParseInt(r.PathValue("eventId"), 10, 64)
	var req struct {
		Targets []store.ApplicationTarget `json:"targets"`
	}
	if err != nil || id < 1 || decodeJSON(r, &req) != nil || req.Targets == nil {
		badRequest(w, "Выберите цели атаки")
		return
	}
	event, err := s.store.SetSessionAttackTargets(r.Context(), uid, session.ID, id, req.Targets)
	if err != nil {
		itemTransferError(w, err)
		return
	}
	s.publishSessionJournal(session.ID)
	writeJSON(w, http.StatusOK, sessionEventResponse{Event: event})
}
