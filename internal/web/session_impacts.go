package web

import (
	"dndshare/internal/store"
	"net/http"
)

func init() { registerRoutes((*Server).routesSessionImpacts) }
func (s *Server) routesSessionImpacts(mux *http.ServeMux) {
	mux.HandleFunc("POST /api/sessions/{uuid}/impacts", s.handleSessionImpact)
}
func (s *Server) handleSessionImpact(w http.ResponseWriter, r *http.Request) {
	uid, session, ok := s.requireSessionEventAccess(w, r)
	if !ok {
		return
	}
	if session.OwnerUserID != uid {
		forbidden(w)
		return
	}
	var req store.SessionImpactRequest
	if decodeJSON(r, &req) != nil || !isUUID(req.ClientActionID) || req.EventID < 0 {
		badRequest(w, "Некорректное применение урона или эффекта")
		return
	}
	for _, row := range req.Targets {
		if row.Target.Kind == "character" && !isUUID(row.Target.CharUUID) {
			badRequest(w, "Некорректная цель")
			return
		}
	}
	notify := func() {}
	if actor := s.store.SessionImpactActor(r.Context(), session.ID, req.EventID); actor > 0 {
		notify = s.concentrationNotifier(r.Context(), actor)
	}
	result, err := s.store.ApplySessionImpact(r.Context(), uid, session.ID, req)
	if err != nil {
		itemTransferError(w, err)
		return
	}
	notify()
	s.sessionLive.publish(session.ID, sessionLiveUpdate{Journal: true, CharacterIDs: result.CharacterIDs})
	s.displayEvents.publish(session.ID)
	writeJSON(w, http.StatusOK, result)
}
