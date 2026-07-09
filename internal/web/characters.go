package web

import (
	"encoding/json"
	"errors"
	"net/http"
	"strings"

	"dndshare/internal/store"
)

func init() { registerRoutes((*Server).routesCharacters) }

func (s *Server) routesCharacters(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/chars", s.handleGetChars)
	mux.HandleFunc("POST /api/chars", s.handleCreateChar)
	mux.HandleFunc("POST /api/chars/poll", s.handlePollChars)
	mux.HandleFunc("GET /api/templates", s.handleGetTemplates)
	mux.HandleFunc("GET /api/char/{uuid}", s.handleGetChar)
	mux.HandleFunc("GET /api/char/{uuid}/version", s.handleGetCharVersion)
	mux.HandleFunc("GET /api/char/{uuid}/sessions", s.handleGetCharSessions)
	mux.HandleFunc("PUT /api/char/{uuid}/data", s.handleUpdateDataChar)
	mux.HandleFunc("PATCH /api/char/{uuid}/data-patch", s.handlePatchCharData)
	mux.HandleFunc("PUT /api/char/{uuid}/public", s.handleUpdatePublicChar)
	mux.HandleFunc("DELETE /api/char/{uuid}", s.handleDeleteChar)
	mux.HandleFunc("POST /api/char/{uuid}/clone", s.handleCloneChar)
}

// --- GET /api/chars ---

type charactersResponse struct {
	Chars          []store.CharacterItem               `json:"chars"`
	SessionsByChar map[string][]store.CharSessionBrief `json:"sessionsByChar"`
}

func (s *Server) handleGetChars(w http.ResponseWriter, r *http.Request) {
	uid, ok := mustUser(w, r)
	if !ok {
		return
	}
	chars, err := s.store.GetCharacters(r.Context(), uid)
	if err != nil {
		serverError(w, err)
		return
	}
	uuids := make([]string, 0, len(chars))
	for _, c := range chars {
		uuids = append(uuids, c.UUID)
	}
	sessionsByChar, err := s.store.SessionsByCharUUIDs(r.Context(), uuids, uid)
	if err != nil {
		serverError(w, err)
		return
	}
	if sessionsByChar == nil {
		sessionsByChar = map[string][]store.CharSessionBrief{}
	}
	writeJSON(w, http.StatusOK, charactersResponse{Chars: nonNil(chars), SessionsByChar: sessionsByChar})
}

// --- POST /api/chars ---

type characterCreateRequest struct {
	TemplateID int64           `json:"templateId"`
	Data       json.RawMessage `json:"data"`
}

type characterCreatedResponse struct {
	UUID   string `json:"uuid"`
	CharID *int64 `json:"charId,omitempty"`
}

func (s *Server) handleCreateChar(w http.ResponseWriter, r *http.Request) {
	uid, ok := mustUser(w, r)
	if !ok {
		return
	}
	var req characterCreateRequest
	if err := decodeJSON(r, &req); err != nil {
		badRequest(w, "Некорректный запрос")
		return
	}
	if _, err := s.store.GetTemplate(r.Context(), req.TemplateID); err != nil {
		if errors.Is(err, store.ErrNotFound) {
			notFound(w, "")
			return
		}
		serverError(w, err)
		return
	}
	uuid, err := s.store.CreateCharacter(r.Context(), uid, req.TemplateID, req.Data)
	if err != nil {
		serverError(w, err)
		return
	}
	resp := characterCreatedResponse{UUID: uuid}
	if char, err := s.store.GetCharacter(r.Context(), uuid); err == nil {
		id := char.ID
		resp.CharID = &id
	}
	writeJSON(w, http.StatusOK, resp)
}

// --- GET /api/templates ---

type templatesResponse struct {
	Templates []store.CharacterTemplate `json:"templates"`
}

func (s *Server) handleGetTemplates(w http.ResponseWriter, r *http.Request) {
	if _, ok := mustUser(w, r); !ok {
		return
	}
	templates, err := s.store.GetTemplates(r.Context())
	if err != nil {
		serverError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, templatesResponse{Templates: nonNil(templates)})
}

// --- GET /api/char/{uuid} ---

type characterResponse struct {
	Template      json.RawMessage `json:"template"`
	TemplateName  string          `json:"templateName"`
	Data          json.RawMessage `json:"data"`
	PublicVisible bool            `json:"publicVisible"`
	UserID        int64           `json:"userId"`
	Version       int64           `json:"version"`
}

func (s *Server) handleGetChar(w http.ResponseWriter, r *http.Request) {
	char, ok := s.loadCharReadable(w, r)
	if !ok {
		return
	}
	template, err := s.store.GetTemplate(r.Context(), char.TemplateID)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			notFound(w, "")
			return
		}
		serverError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, characterResponse{
		Template:      template.Schema,
		TemplateName:  template.Name,
		Data:          char.Data,
		PublicVisible: char.PublicVisible,
		UserID:        char.UserID,
		Version:       char.Version,
	})
}

// --- GET /api/char/{uuid}/version ---

type charVersionResponse struct {
	Version int64 `json:"version"`
}

func (s *Server) handleGetCharVersion(w http.ResponseWriter, r *http.Request) {
	char, ok := s.loadCharReadable(w, r)
	if !ok {
		return
	}
	writeJSON(w, http.StatusOK, charVersionResponse{Version: char.Version})
}

// --- GET /api/char/{uuid}/sessions ---

type charSessionsResponse struct {
	Sessions []store.CharSessionBrief `json:"sessions"`
}

func (s *Server) handleGetCharSessions(w http.ResponseWriter, r *http.Request) {
	uid, ok := mustUser(w, r)
	if !ok {
		return
	}
	char, ok := s.loadChar(w, r)
	if !ok {
		return
	}
	if char.UserID != uid {
		unauthorized(w)
		return
	}
	sessions, err := s.store.SessionsByCharUUID(r.Context(), char.UUID, uid)
	if err != nil {
		serverError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, charSessionsResponse{Sessions: nonNil(sessions)})
}

// --- PUT /api/char/{uuid}/data ---

type characterUpdateRequest struct {
	Data json.RawMessage `json:"data"`
}

type characterUpdateResponse struct{}

func (s *Server) handleUpdateDataChar(w http.ResponseWriter, r *http.Request) {
	_, char, ok := s.loadCharWritable(w, r)
	if !ok {
		return
	}
	var req characterUpdateRequest
	if err := decodeJSON(r, &req); err != nil {
		badRequest(w, "Некорректный запрос")
		return
	}
	if err := s.store.UpdateDataCharacter(r.Context(), char.UUID, req.Data); err != nil {
		serverError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, characterUpdateResponse{})
}

// --- PATCH /api/char/{uuid}/data-patch ---

type characterPathUpdate struct {
	Path  string          `json:"path"`
	Value json.RawMessage `json:"value"`
}

type characterPatchRequest struct {
	Updates []characterPathUpdate `json:"updates"`
}

func (s *Server) handlePatchCharData(w http.ResponseWriter, r *http.Request) {
	_, char, ok := s.loadCharWritable(w, r)
	if !ok {
		return
	}
	var req characterPatchRequest
	if err := decodeJSON(r, &req); err != nil {
		badRequest(w, "Некорректный запрос")
		return
	}
	if len(req.Updates) == 0 {
		w.WriteHeader(http.StatusNoContent)
		return
	}
	updates := make([]store.PathUpdate, 0, len(req.Updates))
	for _, u := range req.Updates {
		updates = append(updates, store.PathUpdate{Path: u.Path, Value: u.Value})
	}
	if err := s.store.UpdateDataByPaths(r.Context(), char.UUID, updates); err != nil {
		serverError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// --- PUT /api/char/{uuid}/public ---

type publicUpdateRequest struct {
	PublicVisible bool `json:"publicVisible"`
}

func (s *Server) handleUpdatePublicChar(w http.ResponseWriter, r *http.Request) {
	uid, ok := mustUser(w, r)
	if !ok {
		return
	}
	char, ok := s.loadChar(w, r)
	if !ok {
		return
	}
	if char.UserID != uid {
		unauthorized(w)
		return
	}
	var req publicUpdateRequest
	if err := decodeJSON(r, &req); err != nil {
		badRequest(w, "Некорректный запрос")
		return
	}
	if err := s.store.UpdatePublicVisible(r.Context(), char.UUID, req.PublicVisible); err != nil {
		serverError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// --- DELETE /api/char/{uuid} ---

func (s *Server) handleDeleteChar(w http.ResponseWriter, r *http.Request) {
	uid, ok := mustUser(w, r)
	if !ok {
		return
	}
	char, ok := s.loadChar(w, r)
	if !ok {
		return
	}
	if char.UserID != uid {
		unauthorized(w)
		return
	}
	if err := s.store.DeleteCharacter(r.Context(), char.UUID); err != nil {
		serverError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// --- POST /api/char/{uuid}/clone ---

func (s *Server) handleCloneChar(w http.ResponseWriter, r *http.Request) {
	uid, ok := mustUser(w, r)
	if !ok {
		return
	}
	char, ok := s.loadChar(w, r)
	if !ok {
		return
	}
	if char.UserID != uid {
		unauthorized(w)
		return
	}
	var dataCopy map[string]any
	if len(char.Data) > 0 {
		if err := json.Unmarshal(char.Data, &dataCopy); err != nil {
			serverError(w, err)
			return
		}
	}
	if dataCopy == nil {
		dataCopy = map[string]any{}
	}
	if template, err := s.store.GetTemplate(r.Context(), char.TemplateID); err == nil {
		if namePath := templateNamePath(template); namePath != "" {
			currentName, _ := getByPath(dataCopy, namePath).(string)
			setByPath(dataCopy, namePath, currentName+" (копия)")
		}
	}
	data, err := json.Marshal(dataCopy)
	if err != nil {
		serverError(w, err)
		return
	}
	newUUID, err := s.store.CreateCharacter(r.Context(), uid, char.TemplateID, data)
	if err != nil {
		serverError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, characterCreatedResponse{UUID: newUUID})
}

// --- POST /api/chars/poll ---

func (s *Server) handlePollChars(w http.ResponseWriter, r *http.Request) {
	uid, ok := mustUser(w, r)
	if !ok {
		return
	}
	var items []store.PollItem
	if err := decodeJSON(r, &items); err != nil {
		badRequest(w, "Некорректный запрос")
		return
	}
	results, err := s.store.PollChars(r.Context(), items, uid)
	if err != nil {
		serverError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, nonNil(results))
}

// --- helpers ---

// loadChar грузит персонажа по {uuid} либо пишет 404.
func (s *Server) loadChar(w http.ResponseWriter, r *http.Request) (store.CharacterItem, bool) {
	uuid := r.PathValue("uuid")
	if !isUUID(uuid) {
		notFound(w, "")
		return store.CharacterItem{}, false
	}
	char, err := s.store.GetCharacter(r.Context(), uuid)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			notFound(w, "")
			return store.CharacterItem{}, false
		}
		serverError(w, err)
		return store.CharacterItem{}, false
	}
	return char, true
}

// loadCharReadable — доступ к персонажу на чтение (@UserParamOptional): публичный или свой, иначе 401.
func (s *Server) loadCharReadable(w http.ResponseWriter, r *http.Request) (store.CharacterItem, bool) {
	char, ok := s.loadChar(w, r)
	if !ok {
		return store.CharacterItem{}, false
	}
	uid, authed := optionalUser(r)
	if !char.PublicVisible && (!authed || char.UserID != uid) {
		unauthorized(w)
		return store.CharacterItem{}, false
	}
	return char, true
}

// loadCharWritable — доступ на запись (@UserParam): владелец либо ГМ сессии с этим персонажем, иначе 401.
func (s *Server) loadCharWritable(w http.ResponseWriter, r *http.Request) (int64, store.CharacterItem, bool) {
	uid, ok := mustUser(w, r)
	if !ok {
		return 0, store.CharacterItem{}, false
	}
	char, ok := s.loadChar(w, r)
	if !ok {
		return 0, store.CharacterItem{}, false
	}
	isOwner := char.UserID == uid
	if !isOwner {
		isDm, err := s.store.IsCharInSessionOwnedBy(r.Context(), char.UUID, uid)
		if err != nil {
			serverError(w, err)
			return 0, store.CharacterItem{}, false
		}
		if !isDm {
			unauthorized(w)
			return 0, store.CharacterItem{}, false
		}
	}
	return uid, char, true
}

// templateNamePath достаёт pathValuesForList["name"] из шаблона.
func templateNamePath(t store.CharacterTemplate) string {
	if len(t.PathValuesForList) == 0 {
		return ""
	}
	var pv map[string]string
	if err := json.Unmarshal(t.PathValuesForList, &pv); err != nil {
		return ""
	}
	return pv["name"]
}

// getByPath читает значение по «a.b.c» из вложенных map (порт CharacterController.getByPath).
func getByPath(data map[string]any, path string) any {
	var cur any = data
	for _, key := range strings.Split(path, ".") {
		m, ok := cur.(map[string]any)
		if !ok {
			return nil
		}
		cur = m[key]
	}
	return cur
}

// setByPath записывает значение по «a.b.c», создавая промежуточные map (порт CharacterController.setByPath).
func setByPath(data map[string]any, path string, value any) {
	parts := strings.Split(path, ".")
	cur := data
	for i := 0; i < len(parts)-1; i++ {
		next, ok := cur[parts[i]].(map[string]any)
		if !ok {
			next = map[string]any{}
			cur[parts[i]] = next
		}
		cur = next
	}
	cur[parts[len(parts)-1]] = value
}
