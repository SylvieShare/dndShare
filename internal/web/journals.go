package web

import (
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"strings"
	"time"

	"dndshare/internal/store"
)

var journalEntryTypes = map[string]bool{
	"battle": true, "dialog": true, "event": true, "newday": true,
}

type journalResponse struct {
	Journal         *store.Journal        `json:"journal"`
	Sources         []store.JournalSource `json:"sources,omitempty"`
	CanEdit         bool                  `json:"canEdit"`
	CanManage       bool                  `json:"canManage"`
	CanSelectSource bool                  `json:"canSelectSource,omitempty"`
}

type journalSectionRequest struct {
	Title string `json:"title"`
	Date  string `json:"date"`
}

type journalEntryRequest struct {
	ExpectedGraphRevision *int64             `json:"expectedGraphRevision"`
	ParentIDs             []int64            `json:"parentIds"`
	GraphPosition         *store.JournalNode `json:"graphPosition"`
	ExpectedChangedAt     time.Time          `json:"expectedChangedAt"`
	Type                  string             `json:"type"`
	Title                 string             `json:"title"`
	Description           string             `json:"desc"`
	Payload               json.RawMessage    `json:"payload"`
}

func init() { registerRoutes((*Server).routesJournals) }

func (s *Server) routesJournals(mux *http.ServeMux) {
	mux.HandleFunc("PUT /api/journals/{journalUuid}/graph", s.handleUpdateJournalGraph)
	mux.HandleFunc("PATCH /api/journals/{journalUuid}/settings", s.handleJournalPlayerEditing)
	mux.HandleFunc("GET /api/char/{uuid}/journal", s.handleGetCharacterJournal)
	mux.HandleFunc("POST /api/char/{uuid}/journals", s.handleCreateCharacterJournal)
	mux.HandleFunc("PUT /api/char/{uuid}/journal-source", s.handleSetCharacterJournal)
	mux.HandleFunc("POST /api/sessions/{uuid}/journal", s.handleCreateSessionJournal)
	mux.HandleFunc("POST /api/sessions/{uuid}/journal/scenario-items/{itemId}", s.handleAppendScenarioJournalItem)
	mux.HandleFunc("GET /api/journals/{journalUuid}", s.handleGetJournal)
	mux.HandleFunc("POST /api/journals/{journalUuid}/sections", s.handleCreateJournalSection)
	mux.HandleFunc("PATCH /api/journals/{journalUuid}/sections/{sectionId}", s.handleUpdateJournalSection)
	mux.HandleFunc("DELETE /api/journals/{journalUuid}/sections/{sectionId}", s.handleDeleteJournalSection)
	mux.HandleFunc("POST /api/journals/{journalUuid}/sections/{sectionId}/entries", s.handleCreateJournalEntry)
	mux.HandleFunc("PATCH /api/journals/{journalUuid}/entries/{entryId}", s.handleUpdateJournalEntry)
	mux.HandleFunc("DELETE /api/journals/{journalUuid}/entries/{entryId}", s.handleDeleteJournalEntry)
}

func (s *Server) handleGetCharacterJournal(w http.ResponseWriter, r *http.Request) {
	userID, ok := mustUser(w, r)
	if !ok {
		return
	}
	character, ok := s.loadChar(w, r)
	if !ok {
		return
	}
	journal, err := s.store.GetCharacterJournal(r.Context(), character.ID)
	if err != nil {
		serverError(w, err)
		return
	}
	owner := character.UserID == userID
	canRead := false
	if journal != nil {
		canRead, err = s.store.UserCanAccessJournal(r.Context(), journal.ID, userID)
		if err != nil {
			serverError(w, err)
			return
		}
		if !canRead {
			journal = nil
		}
	}
	sources := []store.JournalSource{}
	if owner {
		sources, err = s.store.ListJournalSourcesForCharacter(r.Context(), character.ID, userID)
		if err != nil {
			serverError(w, err)
			return
		}
	}
	s.writeJournalResponse(w, r, http.StatusOK, journalResponse{
		Journal: journal, Sources: sources, CanSelectSource: owner,
	})
}

func (s *Server) handleCreateCharacterJournal(w http.ResponseWriter, r *http.Request) {
	userID, character, ok := s.loadCharWritable(w, r)
	if !ok {
		return
	}
	var req struct {
		Name string `json:"name"`
	}
	if err := decodeJSON(r, &req); err != nil {
		badRequest(w, "Некорректный запрос")
		return
	}
	name, ok := journalName(w, req.Name, "Личный дневник")
	if !ok {
		return
	}
	journal, err := s.store.CreatePersonalJournal(r.Context(), character.ID, userID, name)
	if err != nil {
		serverError(w, err)
		return
	}
	s.writeJournalResponse(w, r, http.StatusCreated, journalResponse{Journal: &journal, CanEdit: true, CanSelectSource: true})
}

func (s *Server) handleSetCharacterJournal(w http.ResponseWriter, r *http.Request) {
	userID, character, ok := s.loadCharWritable(w, r)
	if !ok {
		return
	}
	var req struct {
		JournalUUID string `json:"journalUuid"`
	}
	if err := decodeJSON(r, &req); err != nil || !isUUID(req.JournalUUID) {
		badRequest(w, "Некорректный источник дневника")
		return
	}
	sources, err := s.store.ListJournalSourcesForCharacter(r.Context(), character.ID, userID)
	if err != nil {
		serverError(w, err)
		return
	}
	available := false
	for _, source := range sources {
		if source.UUID == req.JournalUUID {
			available = true
			break
		}
	}
	if !available {
		forbidden(w)
		return
	}
	journal, err := s.store.GetJournalByUUID(r.Context(), req.JournalUUID)
	if err != nil {
		writeJournalError(w, err)
		return
	}
	if err := s.store.LinkCharacterJournal(r.Context(), character.ID, journal.ID); err != nil {
		serverError(w, err)
		return
	}
	s.writeJournalResponse(w, r, http.StatusOK, journalResponse{Journal: &journal, Sources: sources, CanEdit: true, CanSelectSource: true})
}

func (s *Server) handleGetSessionJournal(w http.ResponseWriter, r *http.Request) {
	_, session, ok := s.requireSessionEventAccess(w, r)
	if !ok {
		return
	}
	journal, err := s.store.GetSessionJournal(r.Context(), session.ID)
	if err != nil {
		serverError(w, err)
		return
	}
	s.writeJournalResponse(w, r, http.StatusOK, journalResponse{Journal: journal, CanEdit: true})
}

func (s *Server) handleCreateSessionJournal(w http.ResponseWriter, r *http.Request) {
	_, session, ok := s.requireSessionOwner(w, r)
	if !ok {
		return
	}
	var req struct {
		Name string `json:"name"`
	}
	if err := decodeJSON(r, &req); err != nil {
		badRequest(w, "Некорректный запрос")
		return
	}
	name, valid := journalName(w, req.Name, "Дневник · "+session.Name)
	if !valid {
		return
	}
	journal, err := s.store.CreateSessionJournal(r.Context(), session.ID, name)
	if err != nil {
		serverError(w, err)
		return
	}
	s.writeJournalResponse(w, r, http.StatusCreated, journalResponse{Journal: &journal, CanEdit: true})
}

func journalName(w http.ResponseWriter, value, fallback string) (string, bool) {
	value = strings.TrimSpace(value)
	if value == "" {
		value = fallback
	}
	if len([]rune(value)) > 160 {
		badRequest(w, "Название слишком длинное")
		return "", false
	}
	return value, true
}

func (s *Server) requireJournalAccess(w http.ResponseWriter, r *http.Request) (int64, store.Journal, bool) {
	userID, ok := mustUser(w, r)
	if !ok {
		return 0, store.Journal{}, false
	}
	uuid := r.PathValue("journalUuid")
	if !isUUID(uuid) {
		badRequest(w, "Некорректный дневник")
		return 0, store.Journal{}, false
	}
	journal, err := s.store.GetJournalByUUID(r.Context(), uuid)
	if err != nil {
		writeJournalError(w, err)
		return 0, store.Journal{}, false
	}
	allowed, err := s.store.UserCanAccessJournal(r.Context(), journal.ID, userID)
	if err != nil {
		serverError(w, err)
		return 0, store.Journal{}, false
	}
	if !allowed {
		forbidden(w)
		return 0, store.Journal{}, false
	}
	return userID, journal, true
}

func (s *Server) handleGetJournal(w http.ResponseWriter, r *http.Request) {
	_, journal, ok := s.requireJournalAccess(w, r)
	if ok {
		s.writeJournalResponse(w, r, http.StatusOK, journalResponse{Journal: &journal, CanEdit: true})
	}
}

func journalPathID(w http.ResponseWriter, r *http.Request, key string) (int64, bool) {
	id, err := strconv.ParseInt(r.PathValue(key), 10, 64)
	if err != nil || id <= 0 {
		badRequest(w, "Некорректный идентификатор")
		return 0, false
	}
	return id, true
}

func cleanJournalSection(w http.ResponseWriter, req journalSectionRequest) (journalSectionRequest, bool) {
	req.Title = strings.TrimSpace(req.Title)
	req.Date = strings.TrimSpace(req.Date)
	if len([]rune(req.Title)) > 160 || len([]rune(req.Date)) > 32 {
		badRequest(w, "Слишком длинное поле")
		return journalSectionRequest{}, false
	}
	return req, true
}

func cleanJournalEntry(w http.ResponseWriter, req journalEntryRequest) (store.JournalEntryMutation, bool) {
	req.Type = strings.TrimSpace(req.Type)
	req.Title = strings.TrimSpace(req.Title)
	if !journalEntryTypes[req.Type] || len([]rune(req.Title)) > 255 || len([]rune(req.Description)) > 20000 {
		badRequest(w, "Некорректная запись дневника")
		return store.JournalEntryMutation{}, false
	}
	if len(req.Payload) == 0 {
		req.Payload = json.RawMessage("{}")
	}
	if !json.Valid(req.Payload) || len(req.Payload) > 100_000 {
		badRequest(w, "Некорректные данные записи")
		return store.JournalEntryMutation{}, false
	}
	return store.JournalEntryMutation{Type: req.Type, Title: req.Title, Description: req.Description, Payload: req.Payload, ExpectedChangedAt: req.ExpectedChangedAt,
		ExpectedGraphRevision: req.ExpectedGraphRevision, ParentIDs: req.ParentIDs, GraphPosition: req.GraphPosition}, true
}

func writeJournalError(w http.ResponseWriter, err error) {
	if errors.Is(err, store.ErrJournalReadOnly) {
		forbidden(w)
		return
	}
	if errors.Is(err, store.ErrJournalGraphConflict) {
		conflict(w, "Связи или расположение событий изменились. Обновите дневник и повторите действие.")
		return
	}
	if errors.Is(err, store.ErrJournalGraphInvalid) {
		badRequest(w, "Недопустимая связь: нельзя создавать цикл, повторять связь или соединять разные дневники.")
		return
	}
	if errors.Is(err, store.ErrJournalEntryConflict) {
		conflict(w, "Событие уже изменено другим участником. Ваша правка сохранена в поле; скопируйте её, отмените редактирование и откройте обновлённую запись.")
		return
	}
	if errors.Is(err, store.ErrNotFound) {
		notFound(w, "")
		return
	}
	serverError(w, err)
}
