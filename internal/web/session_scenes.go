package web

import (
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"strings"

	"dndshare/internal/store"
)

func init() { registerRoutes((*Server).routesSessionScenes) }

func (s *Server) routesSessionScenes(mux *http.ServeMux) {
	mux.HandleFunc("POST /api/sessions/{uuid}/chapters/{chapterId}/scenes", s.handleCreateScene)
	mux.HandleFunc("PATCH /api/sessions/{uuid}/scenes/{sceneId}", s.handleRenameScene)
	mux.HandleFunc("DELETE /api/sessions/{uuid}/scenes/{sceneId}", s.handleDeleteScene)
	mux.HandleFunc("POST /api/sessions/{uuid}/scenes/{sceneId}/items", s.handleCreateSceneItem)
	mux.HandleFunc("PATCH /api/sessions/{uuid}/scenes/{sceneId}/items/{itemId}", s.handleUpdateSceneItem)
	mux.HandleFunc("DELETE /api/sessions/{uuid}/scenes/{sceneId}/items/{itemId}", s.handleDeleteSceneItem)
}

// requireSceneSession — сессия по uuid или 404 (порт requireSession).
func (s *Server) requireSceneSession(w http.ResponseWriter, r *http.Request) (store.SceneSession, bool) {
	uuid := r.PathValue("uuid")
	if !isUUID(uuid) {
		badRequest(w, "bad uuid")
		return store.SceneSession{}, false
	}
	sess, err := s.store.GetSessionByUUIDForScene(r.Context(), uuid)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			notFound(w, "")
			return store.SceneSession{}, false
		}
		serverError(w, err)
		return store.SceneSession{}, false
	}
	return sess, true
}

// requireDm — сессия с проверкой владельца (порт requireDm): не владелец → 401.
func (s *Server) requireSceneDm(w http.ResponseWriter, r *http.Request, userID int64) (store.SceneSession, bool) {
	sess, ok := s.requireSceneSession(w, r)
	if !ok {
		return store.SceneSession{}, false
	}
	if sess.OwnerUserID != userID {
		unauthorized(w)
		return store.SceneSession{}, false
	}
	return sess, true
}

// requireChapterInSession — глава принадлежит сессии (порт requireChapterInSession).
func (s *Server) requireChapterInSession(w http.ResponseWriter, r *http.Request, chapterID, sessionID int64) bool {
	ch, err := s.store.GetSessionChapter(r.Context(), chapterID)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			notFound(w, "")
			return false
		}
		serverError(w, err)
		return false
	}
	if ch.SessionID != sessionID {
		unauthorized(w)
		return false
	}
	return true
}

// requireSceneInSession — сцена принадлежит сессии через свою главу (порт requireSceneInSession).
func (s *Server) requireSceneInSession(w http.ResponseWriter, r *http.Request, sceneID, sessionID int64) (store.SessionScene, bool) {
	scene, err := s.store.GetSceneByID(r.Context(), sceneID)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			notFound(w, "")
			return store.SessionScene{}, false
		}
		serverError(w, err)
		return store.SessionScene{}, false
	}
	ch, err := s.store.GetSessionChapter(r.Context(), scene.ChapterID)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			notFound(w, "")
			return store.SessionScene{}, false
		}
		serverError(w, err)
		return store.SessionScene{}, false
	}
	if ch.SessionID != sessionID {
		unauthorized(w)
		return store.SessionScene{}, false
	}
	return scene, true
}

func (s *Server) handleCreateScene(w http.ResponseWriter, r *http.Request) {
	userID, ok := mustUser(w, r)
	if !ok {
		return
	}
	sess, ok := s.requireSceneDm(w, r, userID)
	if !ok {
		return
	}
	chapterID, err := strconv.ParseInt(r.PathValue("chapterId"), 10, 64)
	if err != nil {
		badRequest(w, "bad chapterId")
		return
	}
	if !s.requireChapterInSession(w, r, chapterID, sess.ID) {
		return
	}
	var req struct {
		Name string  `json:"name"`
		X    float64 `json:"x"`
		Y    float64 `json:"y"`
	}
	if err := decodeJSON(r, &req); err != nil {
		badRequest(w, "bad body")
		return
	}
	name := strings.TrimSpace(req.Name)
	if name == "" {
		badRequest(w, "")
		return
	}
	scene, err := s.store.CreateScene(r.Context(), chapterID, name, req.X, req.Y)
	if err != nil {
		serverError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, scene)
}

func (s *Server) handleRenameScene(w http.ResponseWriter, r *http.Request) {
	userID, ok := mustUser(w, r)
	if !ok {
		return
	}
	sess, ok := s.requireSceneDm(w, r, userID)
	if !ok {
		return
	}
	sceneID, err := strconv.ParseInt(r.PathValue("sceneId"), 10, 64)
	if err != nil {
		badRequest(w, "bad sceneId")
		return
	}
	if _, ok := s.requireSceneInSession(w, r, sceneID, sess.ID); !ok {
		return
	}
	var req struct {
		Name string `json:"name"`
	}
	if err := decodeJSON(r, &req); err != nil {
		badRequest(w, "bad body")
		return
	}
	name := strings.TrimSpace(req.Name)
	if name == "" {
		badRequest(w, "")
		return
	}
	if err := s.store.RenameScene(r.Context(), sceneID, name); err != nil {
		serverError(w, err)
		return
	}
	scene, err := s.store.GetSceneByID(r.Context(), sceneID)
	if err != nil {
		serverError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, scene)
}

func (s *Server) handleDeleteScene(w http.ResponseWriter, r *http.Request) {
	userID, ok := mustUser(w, r)
	if !ok {
		return
	}
	sess, ok := s.requireSceneDm(w, r, userID)
	if !ok {
		return
	}
	sceneID, err := strconv.ParseInt(r.PathValue("sceneId"), 10, 64)
	if err != nil {
		badRequest(w, "bad sceneId")
		return
	}
	if _, ok := s.requireSceneInSession(w, r, sceneID, sess.ID); !ok {
		return
	}
	if err := s.store.DeleteScene(r.Context(), sceneID); err != nil {
		serverError(w, err)
		return
	}
	writeJSON(w, http.StatusNoContent, nil)
}

func (s *Server) handleCreateSceneItem(w http.ResponseWriter, r *http.Request) {
	userID, ok := mustUser(w, r)
	if !ok {
		return
	}
	sess, ok := s.requireSceneDm(w, r, userID)
	if !ok {
		return
	}
	sceneID, err := strconv.ParseInt(r.PathValue("sceneId"), 10, 64)
	if err != nil {
		badRequest(w, "bad sceneId")
		return
	}
	if _, ok := s.requireSceneInSession(w, r, sceneID, sess.ID); !ok {
		return
	}
	var req struct {
		Type  string          `json:"type"`
		Title *string         `json:"title"`
		Data  json.RawMessage `json:"data"`
		Color *string         `json:"color"`
		X     float64         `json:"x"`
		Y     float64         `json:"y"`
	}
	if err := decodeJSON(r, &req); err != nil {
		badRequest(w, "bad body")
		return
	}
	if req.Type != "text" && req.Type != "list" {
		badRequest(w, "bad block type")
		return
	}
	title := ""
	if req.Title != nil {
		title = strings.TrimSpace(*req.Title)
	}
	item, err := s.store.CreateSceneItem(r.Context(), sceneID, req.Type, title, rawToStr(req.Data), req.Color, req.X, req.Y)
	if err != nil {
		serverError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, item)
}

func (s *Server) handleUpdateSceneItem(w http.ResponseWriter, r *http.Request) {
	userID, ok := mustUser(w, r)
	if !ok {
		return
	}
	sess, ok := s.requireSceneDm(w, r, userID)
	if !ok {
		return
	}
	sceneID, err := strconv.ParseInt(r.PathValue("sceneId"), 10, 64)
	if err != nil {
		badRequest(w, "bad sceneId")
		return
	}
	if _, ok := s.requireSceneInSession(w, r, sceneID, sess.ID); !ok {
		return
	}
	itemID, err := strconv.ParseInt(r.PathValue("itemId"), 10, 64)
	if err != nil {
		badRequest(w, "bad itemId")
		return
	}
	item, err := s.store.GetSceneItem(r.Context(), itemID)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			notFound(w, "")
			return
		}
		serverError(w, err)
		return
	}
	if item.SceneID != sceneID {
		unauthorized(w)
		return
	}
	var req struct {
		Title        *string         `json:"title"`
		Data         json.RawMessage `json:"data"`
		DataChanged  bool            `json:"dataChanged"`
		Color        *string         `json:"color"`
		ColorChanged bool            `json:"colorChanged"`
		PositionX    *float64        `json:"positionX"`
		PositionY    *float64        `json:"positionY"`
	}
	if err := decodeJSON(r, &req); err != nil {
		badRequest(w, "bad body")
		return
	}
	if err := s.store.UpdateSceneItem(r.Context(), itemID, req.Title, rawToStr(req.Data), req.DataChanged, req.Color, req.ColorChanged, req.PositionX, req.PositionY); err != nil {
		serverError(w, err)
		return
	}
	updated, err := s.store.GetSceneItem(r.Context(), itemID)
	if err != nil {
		serverError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, updated)
}

func (s *Server) handleDeleteSceneItem(w http.ResponseWriter, r *http.Request) {
	userID, ok := mustUser(w, r)
	if !ok {
		return
	}
	sess, ok := s.requireSceneDm(w, r, userID)
	if !ok {
		return
	}
	sceneID, err := strconv.ParseInt(r.PathValue("sceneId"), 10, 64)
	if err != nil {
		badRequest(w, "bad sceneId")
		return
	}
	if _, ok := s.requireSceneInSession(w, r, sceneID, sess.ID); !ok {
		return
	}
	itemID, err := strconv.ParseInt(r.PathValue("itemId"), 10, 64)
	if err != nil {
		badRequest(w, "bad itemId")
		return
	}
	item, err := s.store.GetSceneItem(r.Context(), itemID)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			notFound(w, "")
			return
		}
		serverError(w, err)
		return
	}
	if item.SceneID != sceneID {
		unauthorized(w)
		return
	}
	if err := s.store.DeleteSceneItem(r.Context(), itemID); err != nil {
		serverError(w, err)
		return
	}
	writeJSON(w, http.StatusNoContent, nil)
}

// rawToStr — JSON тела запроса → *string для jsonb (nil, если поле отсутствовало/null).
func rawToStr(raw json.RawMessage) *string {
	if len(raw) == 0 || string(raw) == "null" {
		return nil
	}
	str := string(raw)
	return &str
}

// isUUID валидирует каноническую строковую форму UUID.
func isUUID(v string) bool {
	if len(v) != 36 {
		return false
	}
	for i, c := range v {
		if i == 8 || i == 13 || i == 18 || i == 23 {
			if c != '-' {
				return false
			}
			continue
		}
		if !((c >= '0' && c <= '9') || (c >= 'a' && c <= 'f') || (c >= 'A' && c <= 'F')) {
			return false
		}
	}
	return true
}
