package web

import (
	"context"
	"dndshare/internal/store"
	"net/http"
)

func init() { registerRoutes((*Server).routesConcentration) }
func (s *Server) routesConcentration(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/char/{uuid}/concentration", s.handleConcentration)
	mux.HandleFunc("POST /api/char/{uuid}/concentration", s.handleChangeConcentration)
	mux.HandleFunc("POST /api/char/{uuid}/spell-use", s.handleSpellSelfUse)
}
func (s *Server) handleConcentration(w http.ResponseWriter, r *http.Request) {
	c, ok := s.loadChar(w, r)
	if !ok {
		return
	}
	uid, authed := optionalUser(r)
	allowed, err := canReadCharacter(r.Context(), s.store, c, uid, authed)
	if err != nil {
		serverError(w, err)
		return
	}
	if !allowed {
		forbidden(w)
		return
	}
	concentration, err := s.store.CharacterConcentration(r.Context(), c.ID)
	if err != nil {
		serverError(w, err)
		return
	}
	// A public sheet exposes the held spell, not other participants' private identities.
	if concentration != nil && c.UserID != uid {
		concentration.Effects = []store.ConcentrationEffect{}
	}
	writeJSON(w, http.StatusOK, map[string]any{"concentration": concentration})
}
func (s *Server) handleChangeConcentration(w http.ResponseWriter, r *http.Request) {
	uid, c, ok := s.transferOwner(w, r)
	if !ok {
		return
	}
	var req struct {
		SpellID        int64  `json:"spellId"`
		Version        *int64 `json:"version"`
		ClientActionID string `json:"clientActionId"`
		EndID          string `json:"endId"`
	}
	if decodeJSON(r, &req) != nil || req.Version == nil || *req.Version < 0 || !isUUID(req.ClientActionID) || (req.EndID != "" && !isUUID(req.EndID)) || (req.EndID == "" && req.SpellID <= 0) {
		badRequest(w, "Выберите заклинание концентрации")
		return
	}
	notify := s.concentrationNotifier(r.Context(), c.ID)
	concentration, err := s.store.ChangeConcentration(r.Context(), uid, c.ID, *req.Version, req.SpellID, req.ClientActionID, req.EndID)
	if err != nil {
		itemTransferError(w, err)
		return
	}
	notify()
	writeJSON(w, http.StatusOK, map[string]any{"concentration": concentration})
}
func (s *Server) handleSpellSelfUse(w http.ResponseWriter, r *http.Request) {
	uid, c, ok := s.transferOwner(w, r)
	if !ok {
		return
	}
	var req struct {
		SpellID        int64  `json:"spellId"`
		Version        *int64 `json:"version"`
		ClientActionID string `json:"clientActionId"`
		OptionKey      string `json:"optionKey"`
	}
	if decodeJSON(r, &req) != nil || req.Version == nil || *req.Version < 0 || req.SpellID <= 0 || !isUUID(req.ClientActionID) || len(req.OptionKey) > 100 {
		badRequest(w, "Выберите эффект заклинания")
		return
	}
	notify := s.concentrationNotifier(r.Context(), c.ID)
	result, err := s.store.UseSpellSelf(r.Context(), uid, c.ID, *req.Version, req.SpellID, req.OptionKey, req.ClientActionID)
	if err != nil {
		itemTransferError(w, err)
		return
	}
	notify()
	writeJSON(w, http.StatusOK, map[string]any{"result": result})
}
func (s *Server) concentrationNotifier(ctx context.Context, charID int64) func() {
	before, _ := s.store.ConcentrationAudience(ctx, charID)
	return func() {
		after, _ := s.store.ConcentrationAudience(ctx, charID)
		for id, chars := range after {
			before[id] = append(before[id], chars...)
		}
		for sessionID, chars := range before {
			s.sessionLive.publish(sessionID, sessionLiveUpdate{Journal: true, CharacterIDs: chars})
			s.displayEvents.publish(sessionID)
		}
	}
}
