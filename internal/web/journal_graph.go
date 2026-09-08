package web

import (
	"dndshare/internal/store"
	"net/http"
)

func (s *Server) handleUpdateJournalGraph(w http.ResponseWriter, r *http.Request) {
	userID, journal, ok := s.requireJournalWrite(w, r)
	if !ok {
		return
	}
	var req struct {
		ExpectedRevision *int64              `json:"expectedRevision"`
		Links            []store.JournalLink `json:"links"`
		Positions        []store.JournalNode `json:"positions"`
	}
	if err := decodeJSON(r, &req); err != nil || req.ExpectedRevision == nil || *req.ExpectedRevision < 0 ||
		len(req.Links) > 20000 || len(req.Positions) > 5000 || (req.Links == nil && req.Positions == nil) {
		badRequest(w, "Укажите версию графа и изменения связей или расположения")
		return
	}
	if err := s.store.UpdateJournalGraph(r.Context(), journal.ID, userID, store.JournalGraphMutation{
		ExpectedRevision: *req.ExpectedRevision, Links: req.Links, Positions: req.Positions,
	}); err != nil {
		writeJournalError(w, err)
		return
	}
	s.writeReloadedJournal(w, r, journal.UUID, http.StatusOK)
}
