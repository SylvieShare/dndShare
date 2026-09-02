package web

import (
	"net/http"
)

func (s *Server) writeReloadedJournal(w http.ResponseWriter, r *http.Request, uuid string, status int) {
	journal, err := s.store.GetJournalByUUID(r.Context(), uuid)
	if err != nil {
		writeJournalError(w, err)
		return
	}
	writeJSON(w, status, journalResponse{Journal: &journal, CanEdit: true})
}

func (s *Server) handleCreateJournalSection(w http.ResponseWriter, r *http.Request) {
	_, journal, ok := s.requireJournalAccess(w, r)
	if !ok {
		return
	}
	var req journalSectionRequest
	if err := decodeJSON(r, &req); err != nil {
		badRequest(w, "Некорректный запрос")
		return
	}
	req, ok = cleanJournalSection(w, req)
	if !ok {
		return
	}
	if _, err := s.store.CreateJournalSection(r.Context(), journal.ID, req.Title, req.Date); err != nil {
		writeJournalError(w, err)
		return
	}
	s.writeReloadedJournal(w, r, journal.UUID, http.StatusCreated)
}

func (s *Server) handleUpdateJournalSection(w http.ResponseWriter, r *http.Request) {
	_, journal, ok := s.requireJournalAccess(w, r)
	if !ok {
		return
	}
	sectionID, ok := journalPathID(w, r, "sectionId")
	if !ok {
		return
	}
	var req journalSectionRequest
	if err := decodeJSON(r, &req); err != nil {
		badRequest(w, "Некорректный запрос")
		return
	}
	req, ok = cleanJournalSection(w, req)
	if !ok {
		return
	}
	if err := s.store.UpdateJournalSection(r.Context(), journal.ID, sectionID, req.Title, req.Date); err != nil {
		writeJournalError(w, err)
		return
	}
	s.writeReloadedJournal(w, r, journal.UUID, http.StatusOK)
}

func (s *Server) handleDeleteJournalSection(w http.ResponseWriter, r *http.Request) {
	_, journal, ok := s.requireJournalAccess(w, r)
	if !ok {
		return
	}
	sectionID, ok := journalPathID(w, r, "sectionId")
	if !ok {
		return
	}
	if err := s.store.DeleteJournalSection(r.Context(), journal.ID, sectionID); err != nil {
		writeJournalError(w, err)
		return
	}
	s.writeReloadedJournal(w, r, journal.UUID, http.StatusOK)
}

func (s *Server) handleCreateJournalEntry(w http.ResponseWriter, r *http.Request) {
	userID, journal, ok := s.requireJournalAccess(w, r)
	if !ok {
		return
	}
	sectionID, ok := journalPathID(w, r, "sectionId")
	if !ok {
		return
	}
	var req journalEntryRequest
	if err := decodeJSON(r, &req); err != nil {
		badRequest(w, "Некорректный запрос")
		return
	}
	mutation, ok := cleanJournalEntry(w, req)
	if !ok {
		return
	}
	if _, err := s.store.CreateJournalEntry(r.Context(), journal.ID, sectionID, userID, mutation); err != nil {
		writeJournalError(w, err)
		return
	}
	s.writeReloadedJournal(w, r, journal.UUID, http.StatusCreated)
}

func (s *Server) handleUpdateJournalEntry(w http.ResponseWriter, r *http.Request) {
	_, journal, ok := s.requireJournalAccess(w, r)
	if !ok {
		return
	}
	entryID, ok := journalPathID(w, r, "entryId")
	if !ok {
		return
	}
	var req journalEntryRequest
	if err := decodeJSON(r, &req); err != nil {
		badRequest(w, "Некорректный запрос")
		return
	}
	mutation, ok := cleanJournalEntry(w, req)
	if !ok {
		return
	}
	if err := s.store.UpdateJournalEntry(r.Context(), journal.ID, entryID, mutation); err != nil {
		writeJournalError(w, err)
		return
	}
	s.writeReloadedJournal(w, r, journal.UUID, http.StatusOK)
}

func (s *Server) handleDeleteJournalEntry(w http.ResponseWriter, r *http.Request) {
	_, journal, ok := s.requireJournalAccess(w, r)
	if !ok {
		return
	}
	entryID, ok := journalPathID(w, r, "entryId")
	if !ok {
		return
	}
	if err := s.store.DeleteJournalEntry(r.Context(), journal.ID, entryID); err != nil {
		writeJournalError(w, err)
		return
	}
	s.writeReloadedJournal(w, r, journal.UUID, http.StatusOK)
}
