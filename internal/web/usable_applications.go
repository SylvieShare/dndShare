package web

import "net/http"

func init() { registerRoutes((*Server).routesUsableApplications) }
func (s *Server) routesUsableApplications(mux *http.ServeMux) {
	mux.HandleFunc("POST /api/char/{uuid}/usable-use", s.handleUsableSelfUse)
}
func (s *Server) handleUsableSelfUse(w http.ResponseWriter, r *http.Request) {
	uid, c, ok := s.transferOwner(w, r)
	if !ok {
		return
	}
	var req struct {
		Source         string `json:"source"`
		EntryUID       string `json:"entryUid"`
		ClientActionID string `json:"clientActionId"`
		OptionKey      string `json:"optionKey"`
		Version        *int64 `json:"version"`
	}
	if decodeJSON(r, &req) != nil || (req.Source != "potions" && req.Source != "items" && req.Source != "weapon") || !isUUID(req.ClientActionID) || req.EntryUID == "" || len(req.EntryUID) > 200 || len(req.OptionKey) > 100 || req.Version == nil || *req.Version < 0 {
		badRequest(w, "Некорректное применение предмета")
		return
	}
	result, err := s.store.UseItemSelf(r.Context(), uid, c.ID, *req.Version, req.EntryUID, req.ClientActionID, req.OptionKey, req.Source)
	if err != nil {
		itemTransferError(w, err)
		return
	}
	if sessionID, found, e := s.store.SessionIDForCharacter(r.Context(), c.ID); e == nil && found {
		s.sessionLive.publish(sessionID, sessionLiveUpdate{Journal: true, CharacterIDs: []int64{c.ID}})
	}
	writeJSON(w, http.StatusOK, map[string]any{"result": result})
}
