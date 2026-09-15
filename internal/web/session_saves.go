package web

import (
	"dndshare/internal/store"
	"net/http"
	"strconv"
)

func init() { registerRoutes((*Server).routesSessionSaves) }
func (s *Server) routesSessionSaves(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/sessions/{uuid}/save-targets", s.handleSaveTargets)
	mux.HandleFunc("POST /api/sessions/{uuid}/events/{eventId}/saves", s.handleSessionSaves)
}
func (s *Server) handleSaveTargets(w http.ResponseWriter, r *http.Request) {
	uid, session, ok := s.requireSessionEventAccess(w, r)
	if !ok {
		return
	}
	if session.OwnerUserID != uid {
		forbidden(w)
		return
	}
	targets, err := s.store.SessionSaveTargets(r.Context(), uid, session.ID)
	if err != nil {
		itemTransferError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"targets": targets})
}
func (s *Server) handleSessionSaves(w http.ResponseWriter, r *http.Request) {
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
		Results []store.SessionSaveResult `json:"results"`
	}
	if err != nil || id < 1 || decodeJSON(r, &req) != nil {
		badRequest(w, "Выберите цели спасброска")
		return
	}
	event, err := s.store.AppendSessionSaves(r.Context(), uid, session.ID, id, req.Results)
	if err != nil {
		itemTransferError(w, err)
		return
	}
	s.publishSessionJournal(session.ID)
	writeJSON(w, http.StatusOK, sessionEventResponse{Event: event})
}
