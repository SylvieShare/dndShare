package web

import (
	"errors"
	"net/http"
	"strings"
	"time"

	"dndshare/internal/store"
)

type occurrenceRequest struct {
	Number            int       `json:"number"`
	Name              string    `json:"name"`
	Date              string    `json:"date"`
	ExpectedChangedAt time.Time `json:"expectedChangedAt"`
}

func init() { registerRoutes((*Server).routesSessionOccurrences) }
func (s *Server) routesSessionOccurrences(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/sessions/{uuid}/occurrences", s.handleListSessionOccurrences)
	mux.HandleFunc("POST /api/sessions/{uuid}/occurrences", s.handleCreateSessionOccurrence)
	mux.HandleFunc("PATCH /api/sessions/{uuid}/occurrences/{occurrenceId}", s.handleUpdateSessionOccurrence)
	mux.HandleFunc("DELETE /api/sessions/{uuid}/occurrences/{occurrenceId}", s.handleDeleteSessionOccurrence)
}

func cleanOccurrence(w http.ResponseWriter, req occurrenceRequest, updating bool) (store.SessionOccurrenceMutation, bool) {
	req.Name = strings.TrimSpace(req.Name)
	date, err := time.Parse("2006-01-02", req.Date)
	if err != nil || date.Year() < 1 || date.Year() > 9999 {
		badRequest(w, "Выберите дату сессии")
		return store.SessionOccurrenceMutation{}, false
	}
	if req.Number < 1 || req.Number > 1000000 {
		badRequest(w, "Номер сессии должен быть от 1 до 1000000")
		return store.SessionOccurrenceMutation{}, false
	}
	if req.Name == "" || len([]rune(req.Name)) > 160 {
		badRequest(w, "Укажите название сессии до 160 символов")
		return store.SessionOccurrenceMutation{}, false
	}
	if updating && req.ExpectedChangedAt.IsZero() {
		badRequest(w, "Обновите список сессий перед редактированием")
		return store.SessionOccurrenceMutation{}, false
	}
	return store.SessionOccurrenceMutation{Number: req.Number, Name: req.Name, Date: req.Date, ExpectedChangedAt: req.ExpectedChangedAt}, true
}

func writeOccurrenceError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, store.ErrOccurrenceNumber):
		conflict(w, "Сессия с таким номером уже существует")
	case errors.Is(err, store.ErrOccurrenceConflict):
		conflict(w, "Сессия уже изменена. Обновите список перед сохранением.")
	case errors.Is(err, store.ErrNotFound):
		notFound(w, "")
	default:
		serverError(w, err)
	}
}

func (s *Server) writeOccurrences(w http.ResponseWriter, r *http.Request, sessionID int64, status int) {
	occurrences, err := s.store.ListSessionOccurrences(r.Context(), sessionID)
	if err != nil {
		serverError(w, err)
		return
	}
	writeJSON(w, status, map[string]any{"occurrences": occurrences})
}

func (s *Server) handleListSessionOccurrences(w http.ResponseWriter, r *http.Request) {
	_, session, ok := s.requireSessionEventAccess(w, r)
	if !ok {
		return
	}
	s.writeOccurrences(w, r, session.ID, http.StatusOK)
}

func (s *Server) handleCreateSessionOccurrence(w http.ResponseWriter, r *http.Request) {
	_, session, ok := s.requireSessionOwner(w, r)
	if !ok {
		return
	}
	var req occurrenceRequest
	if decodeJSON(r, &req) != nil {
		badRequest(w, "Некорректный запрос")
		return
	}
	m, ok := cleanOccurrence(w, req, false)
	if !ok {
		return
	}
	if _, err := s.store.CreateSessionOccurrence(r.Context(), session.ID, m); err != nil {
		writeOccurrenceError(w, err)
		return
	}
	s.writeOccurrences(w, r, session.ID, http.StatusCreated)
}

func (s *Server) handleUpdateSessionOccurrence(w http.ResponseWriter, r *http.Request) {
	_, session, ok := s.requireSessionOwner(w, r)
	if !ok {
		return
	}
	id, ok := journalPathID(w, r, "occurrenceId")
	if !ok {
		return
	}
	var req occurrenceRequest
	if decodeJSON(r, &req) != nil {
		badRequest(w, "Некорректный запрос")
		return
	}
	m, ok := cleanOccurrence(w, req, true)
	if !ok {
		return
	}
	if err := s.store.UpdateSessionOccurrence(r.Context(), session.ID, id, m); err != nil {
		writeOccurrenceError(w, err)
		return
	}
	s.writeOccurrences(w, r, session.ID, http.StatusOK)
}

func (s *Server) handleDeleteSessionOccurrence(w http.ResponseWriter, r *http.Request) {
	_, session, ok := s.requireSessionOwner(w, r)
	if !ok {
		return
	}
	id, ok := journalPathID(w, r, "occurrenceId")
	if !ok {
		return
	}
	if err := s.store.DeleteSessionOccurrence(r.Context(), session.ID, id); err != nil {
		writeOccurrenceError(w, err)
		return
	}
	s.writeOccurrences(w, r, session.ID, http.StatusOK)
}
