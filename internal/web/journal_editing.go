package web

import (
	"net/http"

	"dndshare/internal/store"
)

func (s *Server) writeJournalResponse(w http.ResponseWriter, r *http.Request, status int, response journalResponse) {
	userID, ok := mustUser(w, r)
	if !ok {
		return
	}
	if response.Journal != nil {
		p, err := s.store.JournalPermissions(r.Context(), response.Journal.ID, userID)
		if err != nil {
			serverError(w, err)
			return
		}
		if !p.Read {
			forbidden(w)
			return
		}
		response.CanEdit, response.CanManage = p.Edit, p.Manage
	}
	writeJSON(w, status, response)
}

func (s *Server) requireJournalWrite(w http.ResponseWriter, r *http.Request) (int64, store.Journal, bool) {
	userID, journal, ok := s.requireJournalAccess(w, r)
	if !ok {
		return 0, store.Journal{}, false
	}
	p, err := s.store.JournalPermissions(r.Context(), journal.ID, userID)
	if err != nil {
		serverError(w, err)
		return 0, store.Journal{}, false
	}
	if !p.Edit {
		forbidden(w)
		return 0, store.Journal{}, false
	}
	return userID, journal, true
}

func (s *Server) handleJournalPlayerEditing(w http.ResponseWriter, r *http.Request) {
	userID, journal, ok := s.requireJournalAccess(w, r)
	if !ok {
		return
	}
	p, err := s.store.JournalPermissions(r.Context(), journal.ID, userID)
	if err != nil {
		serverError(w, err)
		return
	}
	if !p.Manage {
		forbidden(w)
		return
	}
	var req struct {
		PlayersCanEdit *bool `json:"playersCanEdit"`
	}
	if err := decodeJSON(r, &req); err != nil || req.PlayersCanEdit == nil {
		badRequest(w, "Укажите доступ игроков к редактированию")
		return
	}
	if err := s.store.SetJournalPlayerEditing(r.Context(), journal.ID, userID, *req.PlayersCanEdit); err != nil {
		writeJournalError(w, err)
		return
	}
	s.writeReloadedJournal(w, r, journal.UUID, http.StatusOK)
}
