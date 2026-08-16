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
	mux.HandleFunc("PATCH /api/sessions/{uuid}/scenes/{sceneId}", s.handleUpdateScene)
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
		Name                     string                        `json:"name"`
		Status                   string                        `json:"status"`
		ImageID                  int64                         `json:"imageId"`
		X                        float64                       `json:"x"`
		Y                        float64                       `json:"y"`
		PresentationMaterialID   *int64                        `json:"presentationMaterialId"`
		PresentationTrackID      *int64                        `json:"presentationTrackId"`
		PresentationVolume       *float64                      `json:"presentationVolume"`
		PresentationCrossfadeSec *float64                      `json:"presentationCrossfadeSec"`
		PresentationEffect       string                        `json:"presentationEffect"`
		PresentationTransition   string                        `json:"presentationTransition"`
		Relations                []store.SessionEntityRelation `json:"relations"`
	}
	if err := decodeJSON(r, &req); err != nil {
		badRequest(w, "bad body")
		return
	}
	name := strings.TrimSpace(req.Name)
	if name == "" || len([]rune(name)) > 160 {
		badRequest(w, "")
		return
	}
	if !chapterStatuses[req.Status] {
		badRequest(w, "Некорректный статус сценария")
		return
	}
	if !validEntityRelations(req.Relations) {
		badRequest(w, "Некорректные связи сценария")
		return
	}
	if !s.validateSessionImage(w, r, userID, req.ImageID, "story") {
		return
	}
	preset, ok := s.validateScenePresentation(w, r, sess, userID, chapterID, 0,
		req.PresentationMaterialID, req.PresentationTrackID, req.PresentationVolume,
		req.PresentationCrossfadeSec, req.PresentationEffect, req.PresentationTransition, req.Relations)
	if !ok {
		return
	}
	scene, err := s.store.CreateScene(
		r.Context(), sess.ID, chapterID, name, req.Status, req.ImageID, req.X, req.Y, preset,
		cleanEntityRelations(req.Relations),
	)
	if err != nil {
		serverError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, scene)
}

func (s *Server) handleUpdateScene(w http.ResponseWriter, r *http.Request) {
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
	previous, ok := s.requireSceneInSession(w, r, sceneID, sess.ID)
	if !ok {
		return
	}
	var req struct {
		Name                     string                        `json:"name"`
		Status                   string                        `json:"status"`
		ImageID                  int64                         `json:"imageId"`
		PresentationMaterialID   *int64                        `json:"presentationMaterialId"`
		PresentationTrackID      *int64                        `json:"presentationTrackId"`
		PresentationVolume       *float64                      `json:"presentationVolume"`
		PresentationCrossfadeSec *float64                      `json:"presentationCrossfadeSec"`
		PresentationEffect       string                        `json:"presentationEffect"`
		PresentationTransition   string                        `json:"presentationTransition"`
		Relations                []store.SessionEntityRelation `json:"relations"`
	}
	if err := decodeJSON(r, &req); err != nil {
		badRequest(w, "bad body")
		return
	}
	name := strings.TrimSpace(req.Name)
	if name == "" || len([]rune(name)) > 160 {
		badRequest(w, "")
		return
	}
	if !chapterStatuses[req.Status] {
		badRequest(w, "Некорректный статус сценария")
		return
	}
	if !validEntityRelations(req.Relations) {
		badRequest(w, "Некорректные связи сценария")
		return
	}
	if !s.validateSessionImage(w, r, userID, req.ImageID, "story") {
		return
	}
	preset, ok := s.validateScenePresentation(w, r, sess, userID, previous.ChapterID, sceneID,
		req.PresentationMaterialID, req.PresentationTrackID, req.PresentationVolume,
		req.PresentationCrossfadeSec, req.PresentationEffect, req.PresentationTransition, req.Relations)
	if !ok {
		return
	}
	if err := s.store.UpdateScene(
		r.Context(), sess.ID, sceneID, name, req.Status, req.ImageID, preset,
		cleanEntityRelations(req.Relations),
	); err != nil {
		serverError(w, err)
		return
	}
	if previous.ImageID != req.ImageID {
		s.deleteOldImage(r, userID, previous.ImageID)
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
	scene, ok := s.requireSceneInSession(w, r, sceneID, sess.ID)
	if !ok {
		return
	}
	if err := s.store.DeleteScene(r.Context(), sess.ID, sceneID); err != nil {
		serverError(w, err)
		return
	}
	s.deleteOldImage(r, userID, scene.ImageID)
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
		Type       string          `json:"type"`
		Title      *string         `json:"title"`
		Data       json.RawMessage `json:"data"`
		MaterialID *int64          `json:"materialId"`
		X          float64         `json:"x"`
		Y          float64         `json:"y"`
		Width      float64         `json:"width"`
	}
	if err := decodeJSON(r, &req); err != nil {
		badRequest(w, "bad body")
		return
	}
	if !validSceneItemType(req.Type) {
		badRequest(w, "bad block type")
		return
	}
	title := ""
	if req.Title != nil {
		title = strings.TrimSpace(*req.Title)
	}
	if req.Type == "image" || req.Type == "material" {
		validMaterial := func() bool {
			if req.MaterialID == nil {
				return false
			}
			if req.Type == "image" {
				return s.validateMaterialForScene(w, r, sess.ID, sceneID, *req.MaterialID)
			}
			_, ok := s.materialForScene(w, r, sess.ID, sceneID, *req.MaterialID)
			return ok
		}
		if !validMaterial() {
			if req.MaterialID == nil {
				badRequest(w, "Выберите материал")
			}
			return
		}
	} else {
		req.MaterialID = nil
	}
	if isSceneEntityReferenceType(req.Type) && !s.validateSceneEntityReference(w, r, sess.ID, req.Type, req.Data) {
		return
	}
	item, err := s.store.CreateSceneItem(r.Context(), sceneID, req.Type, title, rawToStr(req.Data), req.MaterialID, req.X, req.Y, sceneItemWidth(req.Width, req.Type))
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
		Title           *string         `json:"title"`
		Data            json.RawMessage `json:"data"`
		DataChanged     bool            `json:"dataChanged"`
		MaterialID      *int64          `json:"materialId"`
		MaterialChanged bool            `json:"materialChanged"`
		PositionX       *float64        `json:"positionX"`
		PositionY       *float64        `json:"positionY"`
		Width           *float64        `json:"width"`
	}
	if err := decodeJSON(r, &req); err != nil {
		badRequest(w, "bad body")
		return
	}
	if req.Width != nil {
		width := sceneItemWidth(*req.Width, item.Type)
		req.Width = &width
	}
	if req.MaterialChanged {
		if item.Type != "image" && item.Type != "material" {
			req.MaterialID = nil
		} else if req.MaterialID == nil {
			badRequest(w, "Выберите материал")
			return
		} else if item.Type == "image" && !s.validateMaterialForScene(w, r, sess.ID, sceneID, *req.MaterialID) {
			return
		} else if item.Type == "material" {
			if _, ok := s.materialForScene(w, r, sess.ID, sceneID, *req.MaterialID); !ok {
				return
			}
		}
	}
	if req.DataChanged && isSceneEntityReferenceType(item.Type) && !s.validateSceneEntityReference(w, r, sess.ID, item.Type, req.Data) {
		return
	}
	if err := s.store.UpdateSceneItem(r.Context(), itemID, req.Title, rawToStr(req.Data), req.DataChanged, req.MaterialID, req.MaterialChanged, req.PositionX, req.PositionY, req.Width); err != nil {
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

func validSceneItemType(typ string) bool {
	switch typ {
	case "text", "list", "combat", "reward", "image", "material", "location", "npc", "quest":
		return true
	default:
		return false
	}
}

func isSceneEntityReferenceType(typ string) bool {
	return typ == "location" || typ == "npc" || typ == "quest"
}

func (s *Server) validateSceneEntityReference(w http.ResponseWriter, r *http.Request, sessionID int64, typ string, data json.RawMessage) bool {
	var payload struct {
		ReferenceID int64 `json:"referenceId"`
	}
	if len(data) == 0 || json.Unmarshal(data, &payload) != nil || payload.ReferenceID <= 0 {
		badRequest(w, "Выберите объект сессии")
		return false
	}
	var ownerSessionID int64
	var err error
	switch typ {
	case "location":
		var entity store.SessionLocation
		entity, err = s.store.GetSessionLocation(r.Context(), payload.ReferenceID)
		ownerSessionID = entity.SessionID
	case "npc":
		var entity store.SessionNPC
		entity, err = s.store.GetSessionNPC(r.Context(), payload.ReferenceID)
		ownerSessionID = entity.SessionID
	case "quest":
		var entity store.SessionQuest
		entity, err = s.store.GetSessionQuest(r.Context(), payload.ReferenceID)
		ownerSessionID = entity.SessionID
	}
	if err != nil || ownerSessionID != sessionID {
		badRequest(w, "Объект недоступен в этой сессии")
		return false
	}
	return true
}

func sceneItemWidth(width float64, typ string) float64 {
	if width == 0 {
		if typ == "combat" {
			return 360
		}
		if typ == "reward" {
			return 320
		}
		if typ == "image" || typ == "material" {
			return 360
		}
		if isSceneEntityReferenceType(typ) {
			return 340
		}
		return 300
	}
	if width < 220 {
		return 220
	}
	if width > 640 {
		return 640
	}
	return width
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
