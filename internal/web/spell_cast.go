package web

import (
	"dndshare/internal/store"
	"net/http"
)

func init() { registerRoutes((*Server).routesSpellCast) }
func (s *Server) routesSpellCast(mux *http.ServeMux) {
	mux.HandleFunc("POST /api/char/{uuid}/spell-cast", s.handleSpellCast)
}
func (s *Server) handleSpellCast(w http.ResponseWriter, r *http.Request) {
	uid, c, ok := s.transferOwner(w, r)
	if !ok {
		return
	}
	var req store.SpellCastRequest
	if decodeJSON(r, &req) != nil || req.Version < 0 || !isUUID(req.ClientActionID) || req.SpellID <= 0 || len(req.EntryKey) > 200 || len(req.OptionKey) > 100 || len(req.CreationKey) > 100 || req.CreatedCount < 0 || req.CreatedCount > 999 || len(req.Targets) > 50 || req.DMCount > 50 || req.SessionUUID != "" && !isUUID(req.SessionUUID) {
		badRequest(w, "Некорректное применение заклинания")
		return
	}
	for _, target := range req.Targets {
		if target != "self" && !isUUID(target) {
			badRequest(w, "Некорректная цель")
			return
		}
	}
	notify := s.concentrationNotifier(r.Context(), c.ID)
	result, err := s.store.CastSpell(r.Context(), uid, c.ID, req)
	if err != nil {
		itemTransferError(w, err)
		return
	}
	notify()
	for _, transfer := range result.Transfers {
		s.publishTransferChange(transfer)
	}
	writeJSON(w, http.StatusOK, result)
}
