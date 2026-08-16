package web

import (
	"errors"
	"net/http"
	"strconv"
	"strings"

	"dndshare/internal/store"
)

func init() { registerRoutes((*Server).routesSessionPresentation) }

func (s *Server) routesSessionPresentation(mux *http.ServeMux) {
	mux.HandleFunc("POST /api/sessions/{uuid}/materials", s.handleCreateSessionMaterial)
	mux.HandleFunc("PATCH /api/sessions/{uuid}/materials/{materialId}", s.handleUpdateSessionMaterial)
	mux.HandleFunc("DELETE /api/sessions/{uuid}/materials/{materialId}", s.handleDeleteSessionMaterial)
	mux.HandleFunc("PUT /api/sessions/{uuid}/presentation", s.handleSaveSessionPresentation)
	mux.HandleFunc("GET /api/public/sessions/{uuid}/presentation", s.handleGetPublicPresentation)
}

type sessionMaterialsResponse struct {
	Materials []store.SessionMaterial        `json:"materials"`
	Chapters  []store.SessionMaterialChapter `json:"chapters"`
	Scenes    []store.SessionMaterialScene   `json:"scenes"`
}

func (s *Server) handleGetSessionMaterials(w http.ResponseWriter, r *http.Request) {
	userID, ok := mustUser(w, r)
	if !ok {
		return
	}
	session, ok := s.requireSceneDm(w, r, userID)
	if !ok {
		return
	}
	materials, err := s.store.ListSessionMaterials(r.Context(), session.ID)
	if err != nil {
		serverError(w, err)
		return
	}
	contexts, err := s.store.GetSessionMaterialContexts(r.Context(), session.ID)
	if err != nil {
		serverError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, sessionMaterialsResponse{
		Materials: materials, Chapters: contexts.Chapters, Scenes: contexts.Scenes,
	})
}

type sessionMaterialRequest struct {
	Kind         string                             `json:"kind"`
	Name         string                             `json:"name"`
	Caption      *string                            `json:"caption"`
	Content      *string                            `json:"content"`
	NoteStyle    *string                            `json:"noteStyle"`
	AssetID      *int64                             `json:"assetId"`
	ChapterLinks []store.SessionMaterialChapterLink `json:"chapterLinks"`
	SceneLinks   []store.SessionMaterialSceneLink   `json:"sceneLinks"`
	Relations    []store.SessionEntityRelation      `json:"relations"`
}

var materialKinds = map[string]bool{"image": true, "video": true, "text": true, "note": true, "map": true}
var materialNoteStyles = map[string]bool{"parchment": true, "letter": true, "dossier": true, "arcane": true}

func normalizeOptionalText(value *string, max int) (*string, bool) {
	if value == nil {
		return nil, true
	}
	trimmed := strings.TrimSpace(*value)
	if len([]rune(trimmed)) > max {
		return nil, false
	}
	if trimmed == "" {
		return nil, true
	}
	return &trimmed, true
}

func (s *Server) validateMaterialRequest(w http.ResponseWriter, r *http.Request, session store.SceneSession, req *sessionMaterialRequest) bool {
	req.Name = strings.TrimSpace(req.Name)
	if req.Name == "" || len([]rune(req.Name)) > 160 {
		badRequest(w, "Укажите название материала")
		return false
	}
	caption, ok := normalizeOptionalText(req.Caption, 2000)
	if !ok {
		badRequest(w, "Подпись слишком длинная")
		return false
	}
	req.Caption = caption
	if !materialKinds[req.Kind] {
		badRequest(w, "Некорректный тип материала")
		return false
	}
	content, contentOK := normalizeOptionalText(req.Content, 20000)
	if !contentOK {
		badRequest(w, "Содержимое материала слишком длинное")
		return false
	}
	req.Content = content
	switch req.Kind {
	case "image", "video", "map":
		if req.AssetID == nil || *req.AssetID <= 0 {
			badRequest(w, "Выберите файл материала")
			return false
		}
		req.Content, req.NoteStyle = nil, nil
	case "text":
		if req.Content == nil {
			badRequest(w, "Добавьте текст материала")
			return false
		}
		req.AssetID, req.NoteStyle = nil, nil
	case "note":
		if req.Content == nil {
			badRequest(w, "Добавьте текст записки")
			return false
		}
		if req.NoteStyle == nil || !materialNoteStyles[*req.NoteStyle] {
			badRequest(w, "Выберите оформление записки")
			return false
		}
		req.AssetID = nil
	}
	if len(req.ChapterLinks) > 100 || len(req.SceneLinks) > 100 {
		badRequest(w, "Слишком много связей материала")
		return false
	}
	chapterIDs := make(map[int64]bool, len(req.ChapterLinks))
	for index := range req.ChapterLinks {
		link := &req.ChapterLinks[index]
		if link.ChapterID <= 0 || chapterIDs[link.ChapterID] {
			badRequest(w, "Некорректная связь с главой")
			return false
		}
		chapterIDs[link.ChapterID] = true
		note, ok := normalizeOptionalText(link.Note, 500)
		if !ok {
			badRequest(w, "Заметка к связи слишком длинная")
			return false
		}
		link.Note = note
		if !s.requireChapterInSession(w, r, link.ChapterID, session.ID) {
			return false
		}
	}
	sceneIDs := make(map[int64]bool, len(req.SceneLinks))
	for index := range req.SceneLinks {
		link := &req.SceneLinks[index]
		if link.SceneID <= 0 || sceneIDs[link.SceneID] {
			badRequest(w, "Некорректная связь со сценарием")
			return false
		}
		sceneIDs[link.SceneID] = true
		note, ok := normalizeOptionalText(link.Note, 500)
		if !ok {
			badRequest(w, "Заметка к связи слишком длинная")
			return false
		}
		link.Note = note
		if _, ok := s.requireSceneInSession(w, r, link.SceneID, session.ID); !ok {
			return false
		}
	}
	if !validEntityRelations(req.Relations) {
		badRequest(w, "Некорректные связи материала")
		return false
	}
	req.Relations = cleanEntityRelations(req.Relations)
	return true
}

func (s *Server) validateMaterialAsset(w http.ResponseWriter, r *http.Request, userID int64, req sessionMaterialRequest) bool {
	if req.AssetID == nil {
		return true
	}
	if req.Kind == "image" || req.Kind == "map" {
		return s.validateSessionImage(w, r, userID, *req.AssetID, "story")
	}
	asset, err := s.store.GetActiveUserStorageImage(r.Context(), *req.AssetID, userID)
	if err != nil || asset.Type == nil || *asset.Type != "video" {
		badRequest(w, "Видео недоступно")
		return false
	}
	return true
}

func (s *Server) handleCreateSessionMaterial(w http.ResponseWriter, r *http.Request) {
	userID, ok := mustUser(w, r)
	if !ok {
		return
	}
	session, ok := s.requireSceneDm(w, r, userID)
	if !ok {
		return
	}
	var req sessionMaterialRequest
	if decodeJSON(r, &req) != nil || !s.validateMaterialRequest(w, r, session, &req) {
		return
	}
	if !s.validateMaterialAsset(w, r, userID, req) {
		return
	}
	material, err := s.store.CreateSessionMaterial(
		r.Context(), session.ID, req.Kind, req.Name, req.Caption, req.Content, req.NoteStyle,
		req.AssetID, req.ChapterLinks, req.SceneLinks,
		req.Relations,
	)
	if err != nil {
		serverError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, material)
}

func (s *Server) requireSessionMaterial(w http.ResponseWriter, r *http.Request, sessionID int64) (store.SessionMaterial, bool) {
	id, err := strconv.ParseInt(r.PathValue("materialId"), 10, 64)
	if err != nil {
		badRequest(w, "Некорректный материал")
		return store.SessionMaterial{}, false
	}
	material, err := s.store.GetSessionMaterial(r.Context(), id)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			notFound(w, "")
		} else {
			serverError(w, err)
		}
		return store.SessionMaterial{}, false
	}
	if material.SessionID != sessionID {
		forbidden(w)
		return store.SessionMaterial{}, false
	}
	return material, true
}

func (s *Server) handleUpdateSessionMaterial(w http.ResponseWriter, r *http.Request) {
	userID, ok := mustUser(w, r)
	if !ok {
		return
	}
	session, ok := s.requireSceneDm(w, r, userID)
	if !ok {
		return
	}
	previous, ok := s.requireSessionMaterial(w, r, session.ID)
	if !ok {
		return
	}
	var req sessionMaterialRequest
	if decodeJSON(r, &req) != nil || !s.validateMaterialRequest(w, r, session, &req) {
		return
	}
	if !s.validateMaterialAsset(w, r, userID, req) {
		return
	}
	if err := s.store.UpdateSessionMaterial(
		r.Context(), session.ID, previous.ID, req.Kind, req.Name, req.Caption, req.Content, req.NoteStyle,
		req.AssetID, req.ChapterLinks, req.SceneLinks, req.Relations,
	); err != nil {
		serverError(w, err)
		return
	}
	if previous.AssetID != nil && (req.AssetID == nil || *previous.AssetID != *req.AssetID) {
		s.deleteOldImage(r, userID, *previous.AssetID)
	}
	updated, err := s.store.GetSessionMaterial(r.Context(), previous.ID)
	if err != nil {
		serverError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, updated)
}

func (s *Server) handleDeleteSessionMaterial(w http.ResponseWriter, r *http.Request) {
	userID, ok := mustUser(w, r)
	if !ok {
		return
	}
	session, ok := s.requireSceneDm(w, r, userID)
	if !ok {
		return
	}
	material, ok := s.requireSessionMaterial(w, r, session.ID)
	if !ok {
		return
	}
	if err := s.store.DeleteSessionMaterial(r.Context(), session.ID, material.ID); err != nil {
		if store.IsForeignKeyViolation(err) {
			conflict(w, "Материал используется в сценарии")
		} else {
			serverError(w, err)
		}
		return
	}
	if material.AssetID != nil {
		s.deleteOldImage(r, userID, *material.AssetID)
	}
	writeJSON(w, http.StatusNoContent, nil)
}

func (s *Server) handleGetSessionPresentation(w http.ResponseWriter, r *http.Request) {
	userID, ok := mustUser(w, r)
	if !ok {
		return
	}
	session, ok := s.requireSceneDm(w, r, userID)
	if !ok {
		return
	}
	state, err := s.store.GetSessionPresentation(r.Context(), session.ID)
	if err != nil {
		serverError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, state)
}

type sessionPresentationRequest struct {
	Mode       string `json:"mode"`
	Visible    *bool  `json:"visible"`
	MaterialID *int64 `json:"materialId"`
	SceneID    *int64 `json:"sceneId"`
	Effect     string `json:"effect"`
	Transition string `json:"transition"`
}

func (s *Server) handleSaveSessionPresentation(w http.ResponseWriter, r *http.Request) {
	userID, ok := mustUser(w, r)
	if !ok {
		return
	}
	session, ok := s.requireSceneDm(w, r, userID)
	if !ok {
		return
	}
	var req sessionPresentationRequest
	if decodeJSON(r, &req) != nil {
		badRequest(w, "Некорректный запрос")
		return
	}
	visible := req.Mode != "idle"
	if req.Visible != nil {
		visible = *req.Visible
	}
	switch req.Mode {
	case "idle":
		req.MaterialID, req.SceneID, visible = nil, nil, false
	case "material":
		if req.MaterialID == nil {
			badRequest(w, "Выберите материал")
			return
		}
		req.SceneID = nil
	case "scene":
		if req.SceneID == nil {
			badRequest(w, "Выберите сценарий")
			return
		}
		scene, ok := s.requireSceneInSession(w, r, *req.SceneID, session.ID)
		if !ok {
			return
		}
		if req.MaterialID == nil {
			req.MaterialID = scene.PresentationMaterialID
		}
		if req.Effect == "" {
			req.Effect = scene.PresentationEffect
		}
		if req.Transition == "" {
			req.Transition = scene.PresentationTransition
		}
	case "combat":
		req.MaterialID, req.SceneID = nil, nil
	default:
		badRequest(w, "Некорректный режим показа")
		return
	}
	if req.MaterialID != nil {
		material, err := s.store.GetSessionMaterial(r.Context(), *req.MaterialID)
		if err != nil || material.SessionID != session.ID {
			badRequest(w, "Материал недоступен")
			return
		}
	}
	req.Effect, req.Transition = normalizePresentationStyle(req.Effect, req.Transition)
	if !presentationEffects[req.Effect] || !presentationTransitions[req.Transition] {
		badRequest(w, "Некорректный эффект показа")
		return
	}
	state, err := s.store.SaveSessionPresentation(r.Context(), session.ID, req.Mode, visible, req.MaterialID, req.SceneID, req.Effect, req.Transition)
	if err != nil {
		serverError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, state)
}

type publicPresentationResponse struct {
	SessionName string                      `json:"sessionName"`
	Mode        string                      `json:"mode"`
	Visible     bool                        `json:"visible"`
	Material    *publicPresentationMaterial `json:"material,omitempty"`
	Scene       *publicPresentationScene    `json:"scene,omitempty"`
	Effect      string                      `json:"effect"`
	Transition  string                      `json:"transition"`
	Revision    int64                       `json:"revision"`
}

type publicPresentationMaterial struct {
	ID        int64   `json:"id"`
	Kind      string  `json:"kind"`
	Name      string  `json:"name"`
	Caption   *string `json:"caption,omitempty"`
	Content   *string `json:"content,omitempty"`
	NoteStyle *string `json:"noteStyle,omitempty"`
	AssetURL  string  `json:"assetUrl,omitempty"`
}

type publicPresentationScene struct {
	ID       int64  `json:"id"`
	Name     string `json:"name"`
	ImageURL string `json:"imageUrl"`
}

func (s *Server) handleGetPublicPresentation(w http.ResponseWriter, r *http.Request) {
	uuid := r.PathValue("uuid")
	if !isUUID(uuid) {
		notFound(w, "")
		return
	}
	session, err := s.store.GetGameSessionByUUID(r.Context(), uuid)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			notFound(w, "")
		} else {
			serverError(w, err)
		}
		return
	}
	state, err := s.store.GetSessionPresentation(r.Context(), session.ID)
	if err != nil {
		serverError(w, err)
		return
	}
	response := publicPresentationResponse{
		SessionName: session.Name, Mode: state.Mode, Visible: state.Visible,
		Effect: state.Effect, Transition: state.Transition, Revision: state.Revision,
	}
	if state.Material != nil {
		response.Material = &publicPresentationMaterial{
			ID: state.Material.ID, Kind: state.Material.Kind, Name: state.Material.Name,
			Caption: state.Material.Caption, Content: state.Material.Content,
			NoteStyle: state.Material.NoteStyle, AssetURL: state.Material.AssetURL,
		}
	}
	if state.Scene != nil {
		response.Scene = &publicPresentationScene{ID: state.Scene.ID, Name: state.Scene.Name, ImageURL: state.Scene.ImageURL}
	}
	w.Header().Set("Cache-Control", "no-store")
	writeJSON(w, http.StatusOK, response)
}
