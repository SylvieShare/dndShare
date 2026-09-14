package web

import (
	"dndshare/internal/store"
	"net/http"
	"strconv"
)

func init() { registerRoutes((*Server).routesApplicationTargets) }
func (s *Server) routesApplicationTargets(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/sessions/{uuid}/application-targets", s.handleApplicationTargets)
	mux.HandleFunc("POST /api/sessions/{uuid}/events/{eventId}/application", s.handleResolveSessionApplication)
}
func (s *Server) handleApplicationTargets(w http.ResponseWriter, r *http.Request) {
	uid, ok := mustUser(w, r)
	if !ok {
		return
	}
	session, err := s.lookupSession(w, r)
	if err != nil {
		return
	}
	targets, err := s.store.SessionApplicationTargets(r.Context(), uid, session.ID)
	if err != nil {
		itemTransferError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"targets": targets})
}
func (s *Server) handleResolveSessionApplication(w http.ResponseWriter, r *http.Request) {
	uid, ok := mustUser(w, r)
	if !ok {
		return
	}
	session, err := s.lookupSession(w, r)
	if err != nil {
		return
	}
	if session.OwnerUserID != uid {
		forbidden(w)
		return
	}
	id, err := strconv.ParseInt(r.PathValue("eventId"), 10, 64)
	var req struct {
		Decision string                  `json:"decision"`
		Target   store.ApplicationTarget `json:"target"`
	}
	if err != nil || id <= 0 || decodeJSON(r, &req) != nil || (req.Decision != "accept" && req.Decision != "reject") || (req.Target.Kind == "character" && !isUUID(req.Target.CharUUID)) {
		badRequest(w, "Выберите цель и решение")
		return
	}
	transfer, err := s.store.ResolveSessionApplication(r.Context(), uid, session.ID, id, req.Decision == "accept", req.Target)
	if err != nil {
		itemTransferError(w, err)
		return
	}
	s.publishTransferChange(transfer)
	writeJSON(w, http.StatusOK, map[string]any{"transfer": transfer})
}
