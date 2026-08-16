package web

import (
	"errors"
	"net/http"
	"regexp"
	"strconv"
	"strings"

	"dndshare/internal/store"
)

var sessionWorldColor = regexp.MustCompile(`^#[0-9a-fA-F]{6}$`)

var sessionLocationKinds = map[string]bool{
	"region": true, "settlement": true, "district": true, "building": true,
	"room": true, "wilderness": true, "dungeon": true, "other": true,
}

func init() { registerRoutes((*Server).routesSessionWorld) }

func (s *Server) routesSessionWorld(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/sessions/{uuid}/world", s.handleGetSessionWorld)
	mux.HandleFunc("POST /api/sessions/{uuid}/locations", s.handleCreateSessionLocation)
	mux.HandleFunc("PATCH /api/sessions/{uuid}/locations/{locationId}", s.handleUpdateSessionLocation)
	mux.HandleFunc("PATCH /api/sessions/{uuid}/locations/{locationId}/move", s.handleMoveSessionLocation)
	mux.HandleFunc("DELETE /api/sessions/{uuid}/locations/{locationId}", s.handleDeleteSessionLocation)
	mux.HandleFunc("POST /api/sessions/{uuid}/npcs", s.handleCreateSessionNPC)
	mux.HandleFunc("PATCH /api/sessions/{uuid}/npcs/{npcId}", s.handleUpdateSessionNPC)
	mux.HandleFunc("DELETE /api/sessions/{uuid}/npcs/{npcId}", s.handleDeleteSessionNPC)
}

type locationMutationRequest struct {
	ParentLocationID *int64  `json:"parentLocationId"`
	Name             string  `json:"name"`
	Kind             string  `json:"kind"`
	Description      *string `json:"description"`
	ImagePresetKey   *string `json:"imagePresetKey"`
	SceneIDs         []int64 `json:"sceneIds"`
}

type npcMutationRequest struct {
	Name        string  `json:"name"`
	Role        *string `json:"role"`
	Description *string `json:"description"`
	Color       string  `json:"color"`
	LocationIDs []int64 `json:"locationIds"`
	SceneIDs    []int64 `json:"sceneIds"`
}

type sessionWorldMutationResponse struct {
	World store.SessionWorld `json:"world"`
	ID    int64              `json:"id"`
}

func sessionWorldPathID(w http.ResponseWriter, r *http.Request, key string) (int64, bool) {
	id, err := strconv.ParseInt(r.PathValue(key), 10, 64)
	if err != nil || id <= 0 {
		badRequest(w, "Некорректный идентификатор")
		return 0, false
	}
	return id, true
}

func validSessionWorldIDs(ids []int64) bool {
	for _, id := range ids {
		if id <= 0 {
			return false
		}
	}
	return true
}

func locationMutation(
	w http.ResponseWriter,
	req locationMutationRequest,
) (store.SessionLocationMutation, bool) {
	name := strings.TrimSpace(req.Name)
	if name == "" || len([]rune(name)) > 160 {
		badRequest(w, "Укажите название локации")
		return store.SessionLocationMutation{}, false
	}
	if !sessionLocationKinds[req.Kind] {
		badRequest(w, "Некорректный тип локации")
		return store.SessionLocationMutation{}, false
	}
	if req.ParentLocationID != nil && *req.ParentLocationID <= 0 {
		badRequest(w, "Некорректная родительская локация")
		return store.SessionLocationMutation{}, false
	}
	if req.ImagePresetKey != nil {
		preset := strings.TrimSpace(*req.ImagePresetKey)
		if !sessionImagePresets[preset] {
			badRequest(w, "Некорректное изображение локации")
			return store.SessionLocationMutation{}, false
		}
		req.ImagePresetKey = &preset
	}
	if len(req.SceneIDs) > 500 || !validSessionWorldIDs(req.SceneIDs) {
		badRequest(w, "Слишком много привязанных сценариев")
		return store.SessionLocationMutation{}, false
	}
	return store.SessionLocationMutation{
		ParentLocationID: req.ParentLocationID,
		Name:             name,
		Kind:             req.Kind,
		Description:      cleanText(req.Description, 5000),
		ImagePresetKey:   req.ImagePresetKey,
		SceneIDs:         req.SceneIDs,
	}, true
}

func npcMutation(w http.ResponseWriter, req npcMutationRequest) (store.SessionNPCMutation, bool) {
	name := strings.TrimSpace(req.Name)
	if name == "" || len([]rune(name)) > 160 {
		badRequest(w, "Укажите имя NPC")
		return store.SessionNPCMutation{}, false
	}
	if req.Color == "" {
		req.Color = "#7c5cff"
	}
	if !sessionWorldColor.MatchString(req.Color) {
		badRequest(w, "Некорректный цвет NPC")
		return store.SessionNPCMutation{}, false
	}
	if len(req.LocationIDs) > 500 || len(req.SceneIDs) > 500 ||
		!validSessionWorldIDs(req.LocationIDs) || !validSessionWorldIDs(req.SceneIDs) {
		badRequest(w, "Слишком много привязок")
		return store.SessionNPCMutation{}, false
	}
	return store.SessionNPCMutation{
		Name:        name,
		Role:        cleanText(req.Role, 160),
		Description: cleanText(req.Description, 5000),
		Color:       strings.ToLower(req.Color),
		LocationIDs: req.LocationIDs,
		SceneIDs:    req.SceneIDs,
	}, true
}

func (s *Server) writeSessionWorldMutation(
	w http.ResponseWriter,
	r *http.Request,
	sessionID, selectedID int64,
) {
	world, err := s.store.GetSessionWorld(r.Context(), sessionID)
	if err != nil {
		serverError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, sessionWorldMutationResponse{World: world, ID: selectedID})
}

func writeSessionWorldStoreError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, store.ErrNotFound):
		notFound(w, "")
	case errors.Is(err, store.ErrLocationHasChildren):
		conflict(w, "Сначала переместите или удалите вложенные локации")
	case errors.Is(err, store.ErrInvalidWorldReference):
		badRequest(w, "Локация или сценарий не принадлежит этой сессии")
	default:
		serverError(w, err)
	}
}

func (s *Server) handleGetSessionWorld(w http.ResponseWriter, r *http.Request) {
	_, session, ok := s.requireSessionOwner(w, r)
	if !ok {
		return
	}
	world, err := s.store.GetSessionWorld(r.Context(), session.ID)
	if err != nil {
		serverError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, world)
}

func (s *Server) handleCreateSessionLocation(w http.ResponseWriter, r *http.Request) {
	_, session, ok := s.requireSessionOwner(w, r)
	if !ok {
		return
	}
	var req locationMutationRequest
	if err := decodeJSON(r, &req); err != nil {
		badRequest(w, "Некорректный запрос")
		return
	}
	mutation, ok := locationMutation(w, req)
	if !ok {
		return
	}
	id, err := s.store.CreateSessionLocation(r.Context(), session.ID, mutation)
	if err != nil {
		writeSessionWorldStoreError(w, err)
		return
	}
	s.writeSessionWorldMutation(w, r, session.ID, id)
}

func (s *Server) handleUpdateSessionLocation(w http.ResponseWriter, r *http.Request) {
	_, session, ok := s.requireSessionOwner(w, r)
	if !ok {
		return
	}
	id, ok := sessionWorldPathID(w, r, "locationId")
	if !ok {
		return
	}
	var req locationMutationRequest
	if err := decodeJSON(r, &req); err != nil {
		badRequest(w, "Некорректный запрос")
		return
	}
	mutation, ok := locationMutation(w, req)
	if !ok {
		return
	}
	if err := s.store.UpdateSessionLocation(r.Context(), session.ID, id, mutation); err != nil {
		writeSessionWorldStoreError(w, err)
		return
	}
	s.writeSessionWorldMutation(w, r, session.ID, id)
}

func (s *Server) handleMoveSessionLocation(w http.ResponseWriter, r *http.Request) {
	_, session, ok := s.requireSessionOwner(w, r)
	if !ok {
		return
	}
	id, ok := sessionWorldPathID(w, r, "locationId")
	if !ok {
		return
	}
	var req struct {
		ParentLocationID *int64 `json:"parentLocationId"`
		BeforeLocationID *int64 `json:"beforeLocationId"`
	}
	if err := decodeJSON(r, &req); err != nil {
		badRequest(w, "Некорректный запрос")
		return
	}
	if err := s.store.MoveSessionLocation(
		r.Context(), session.ID, id, req.ParentLocationID, req.BeforeLocationID,
	); err != nil {
		writeSessionWorldStoreError(w, err)
		return
	}
	s.writeSessionWorldMutation(w, r, session.ID, id)
}

func (s *Server) handleDeleteSessionLocation(w http.ResponseWriter, r *http.Request) {
	_, session, ok := s.requireSessionOwner(w, r)
	if !ok {
		return
	}
	id, ok := sessionWorldPathID(w, r, "locationId")
	if !ok {
		return
	}
	if err := s.store.DeleteSessionLocation(r.Context(), session.ID, id); err != nil {
		writeSessionWorldStoreError(w, err)
		return
	}
	s.writeSessionWorldMutation(w, r, session.ID, 0)
}

func (s *Server) handleCreateSessionNPC(w http.ResponseWriter, r *http.Request) {
	_, session, ok := s.requireSessionOwner(w, r)
	if !ok {
		return
	}
	var req npcMutationRequest
	if err := decodeJSON(r, &req); err != nil {
		badRequest(w, "Некорректный запрос")
		return
	}
	mutation, ok := npcMutation(w, req)
	if !ok {
		return
	}
	id, err := s.store.CreateSessionNPC(r.Context(), session.ID, mutation)
	if err != nil {
		writeSessionWorldStoreError(w, err)
		return
	}
	s.writeSessionWorldMutation(w, r, session.ID, id)
}

func (s *Server) handleUpdateSessionNPC(w http.ResponseWriter, r *http.Request) {
	_, session, ok := s.requireSessionOwner(w, r)
	if !ok {
		return
	}
	id, ok := sessionWorldPathID(w, r, "npcId")
	if !ok {
		return
	}
	var req npcMutationRequest
	if err := decodeJSON(r, &req); err != nil {
		badRequest(w, "Некорректный запрос")
		return
	}
	mutation, ok := npcMutation(w, req)
	if !ok {
		return
	}
	if err := s.store.UpdateSessionNPC(r.Context(), session.ID, id, mutation); err != nil {
		writeSessionWorldStoreError(w, err)
		return
	}
	s.writeSessionWorldMutation(w, r, session.ID, id)
}

func (s *Server) handleDeleteSessionNPC(w http.ResponseWriter, r *http.Request) {
	_, session, ok := s.requireSessionOwner(w, r)
	if !ok {
		return
	}
	id, ok := sessionWorldPathID(w, r, "npcId")
	if !ok {
		return
	}
	if err := s.store.DeleteSessionNPC(r.Context(), session.ID, id); err != nil {
		writeSessionWorldStoreError(w, err)
		return
	}
	s.writeSessionWorldMutation(w, r, session.ID, 0)
}
