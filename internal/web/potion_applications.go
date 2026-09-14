package web

import "net/http"

func init() { registerRoutes((*Server).routesPotionApplications) }
func (s *Server) routesPotionApplications(mux *http.ServeMux) {
	mux.HandleFunc("POST /api/char/{uuid}/potion-use", s.handlePotionSelfUse)
}
func (s *Server) handlePotionSelfUse(w http.ResponseWriter, r *http.Request) {
	uid, c, ok := s.transferOwner(w, r)
	if !ok {
		return
	}
	var req struct {
		EntryUID       string `json:"entryUid"`
		ClientActionID string `json:"clientActionId"`
		OptionKey      string `json:"optionKey"`
		Version        *int64 `json:"version"`
	}
	if decodeJSON(r, &req) != nil || !isUUID(req.ClientActionID) || req.EntryUID == "" || len(req.EntryUID) > 200 || len(req.OptionKey) > 100 || req.Version == nil || *req.Version < 0 {
		badRequest(w, "Некорректное применение зелья")
		return
	}
	result, err := s.store.UsePotionSelf(r.Context(), uid, c.ID, *req.Version, req.EntryUID, req.ClientActionID, req.OptionKey)
	if err != nil {
		itemTransferError(w, err)
		return
	}
	if sessionID, found, e := s.store.SessionIDForCharacter(r.Context(), c.ID); e == nil && found {
		s.sessionLive.publish(sessionID, sessionLiveUpdate{Journal: true, CharacterIDs: []int64{c.ID}})
	}
	writeJSON(w, http.StatusOK, map[string]any{"result": result})
}
