package web

import (
	"dndshare/internal/store"
	"net/http"
)

func init() { registerRoutes((*Server).routesCharacterRoll) }
func (s *Server) routesCharacterRoll(mux *http.ServeMux) {
	mux.HandleFunc("POST /api/char/{uuid}/dice-roll", s.handleCharacterRoll)
}
func (s *Server) handleCharacterRoll(w http.ResponseWriter, r *http.Request) {
	user, c, ok := s.loadCharWritable(w, r)
	if !ok {
		return
	}
	var request store.CharacterRollRequest
	if decodeJSON(r, &request) != nil || !isUUID(request.ClientActionID) || !isUUID(request.SessionUUID) || !store.ValidCharacterRoll(request) {
		badRequest(w, "Некорректные параметры броска персонажа")
		return
	}
	result, err := s.store.RollCharacter(r.Context(), user, c.ID, request)
	if err != nil {
		itemTransferError(w, err)
		return
	}
	s.publishCharacterChange(r.Context(), c.ID)
	if session, err := s.store.GetGameSessionByUUID(r.Context(), request.SessionUUID); err == nil {
		s.publishSessionOverview(session.ID)
		s.publishSessionJournal(session.ID)
	}
	writeJSON(w, http.StatusOK, result)
}
