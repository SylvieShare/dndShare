package web

import (
	"dndshare/internal/store"
	"net/http"
	"strconv"
)

func init() { registerRoutes((*Server).routesSessionSequences) }
func (s *Server) routesSessionSequences(mux *http.ServeMux) {
	mux.HandleFunc("POST /api/sessions/{uuid}/events/{eventId}/sequence", s.handleSessionSequence)
}
func (s *Server) handleSessionSequence(w http.ResponseWriter, r *http.Request) {
	uid, session, ok := s.requireSessionEventAccess(w, r)
	if !ok {
		return
	}
	id, err := strconv.ParseInt(r.PathValue("eventId"), 10, 64)
	var req store.SequenceCommand
	if err != nil || id < 1 || decodeJSON(r, &req) != nil || !isUUID(req.ClientActionID) || req.Revision < 0 {
		badRequest(w, "Некорректный шаг заклинания")
		return
	}
	event, err := s.store.AdvanceSessionSequence(r.Context(), uid, session.ID, id, req)
	if err != nil {
		itemTransferError(w, err)
		return
	}
	s.publishSessionJournal(session.ID)
	writeJSON(w, http.StatusOK, sessionEventResponse{Event: event})
}
