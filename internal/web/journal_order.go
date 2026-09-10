package web

import "net/http"

func (s *Server) handleReorderJournalEntries(w http.ResponseWriter, r *http.Request) {
	userID, journal, ok := s.requireJournalWrite(w, r)
	if !ok {
		return
	}
	sectionID, ok := journalPathID(w, r, "sectionId")
	if !ok {
		return
	}
	var req struct {
		EntryIDs         []int64 `json:"entryIds"`
		ExpectedEntryIDs []int64 `json:"expectedEntryIds"`
	}
	if err := decodeJSON(r, &req); err != nil || req.EntryIDs == nil || req.ExpectedEntryIDs == nil || len(req.EntryIDs) > 5000 || len(req.ExpectedEntryIDs) > 5000 {
		badRequest(w, "Укажите прежний и новый порядок событий")
		return
	}
	if err := s.store.ReorderJournalEntries(r.Context(), journal.ID, sectionID, userID, req.EntryIDs, req.ExpectedEntryIDs); err != nil {
		writeJournalError(w, err)
		return
	}
	s.writeReloadedJournal(w, r, journal.UUID, http.StatusOK)
}
