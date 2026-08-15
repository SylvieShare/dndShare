package web

import (
	"math"
	"net/http"
	"strconv"
	"strings"

	"dndshare/internal/store"
)

var chapterStatuses = map[string]bool{
	"none":  true,
	"draft": true, "planned": true, "ready": true, "available": true,
	"in_progress": true, "paused": true, "completed": true, "failed": true,
	"skipped": true, "cancelled": true,
}

var sessionImagePresets = map[string]bool{
	"city": true, "village": true, "camp": true, "road": true,
	"forest": true, "cave": true, "ruins": true, "castle": true,
	"tavern": true, "dungeon": true, "mountains": true, "coast": true,
	"battle": true, "investigation": true, "negotiation": true,
	"chase": true, "puzzle": true, "discovery": true,
}

type chaptersResponse struct {
	Chapters []store.SessionChapter `json:"chapters"`
}

func (s *Server) handleGetChapterGraph(w http.ResponseWriter, r *http.Request) {
	userID, ok := mustUser(w, r)
	if !ok {
		return
	}
	session, err := s.lookupSession(w, r)
	if err != nil {
		return
	}
	if session.OwnerUserID != userID {
		forbidden(w)
		return
	}
	graph, err := s.store.GetChapterGraph(r.Context(), session.ID)
	if err != nil {
		serverError(w, err)
		return
	}
	graph.Arcs = nonNil(graph.Arcs)
	graph.Chapters = nonNil(graph.Chapters)
	graph.Edges = nonNil(graph.Edges)
	writeJSON(w, http.StatusOK, graph)
}

func (s *Server) handleGetChapters(w http.ResponseWriter, r *http.Request) {
	if _, ok := mustUser(w, r); !ok {
		return
	}
	session, err := s.lookupSession(w, r)
	if err != nil {
		return
	}
	chapters, err := s.store.GetChaptersBySession(r.Context(), session.ID)
	if err != nil {
		serverError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, chaptersResponse{Chapters: nonNil(chapters)})
}

type chapterMutationRequest struct {
	ArcID          int64   `json:"arcId"`
	Number         string  `json:"number"`
	Name           string  `json:"name"`
	Description    *string `json:"description"`
	Status         string  `json:"status"`
	ImagePresetKey *string `json:"imagePresetKey"`
	CustomImageID  *int64  `json:"customImageId"`
	ImageFocalX    float64 `json:"imageFocalX"`
	ImageFocalY    float64 `json:"imageFocalY"`
	PositionX      float64 `json:"positionX"`
	PositionY      float64 `json:"positionY"`
}

func (s *Server) chapterMutation(w http.ResponseWriter, r *http.Request, userID, sessionID int64, body chapterMutationRequest) (store.ChapterMutation, bool) {
	arc, err := s.store.GetSessionArc(r.Context(), body.ArcID)
	if err != nil || arc.SessionID != sessionID {
		badRequest(w, "Арка не принадлежит сессии")
		return store.ChapterMutation{}, false
	}
	number := strings.TrimSpace(body.Number)
	name := strings.TrimSpace(body.Name)
	if number == "" || len([]rune(number)) > 24 {
		badRequest(w, "Укажите номер главы")
		return store.ChapterMutation{}, false
	}
	if name == "" || len([]rune(name)) > 160 {
		badRequest(w, "Укажите название главы")
		return store.ChapterMutation{}, false
	}
	if !chapterStatuses[body.Status] {
		badRequest(w, "Некорректный статус главы")
		return store.ChapterMutation{}, false
	}
	if body.ImagePresetKey != nil {
		preset := strings.TrimSpace(*body.ImagePresetKey)
		if !sessionImagePresets[preset] {
			badRequest(w, "Некорректный пресет изображения")
			return store.ChapterMutation{}, false
		}
		body.ImagePresetKey = &preset
	}
	if body.ImagePresetKey != nil && body.CustomImageID != nil {
		badRequest(w, "Выберите один источник изображения")
		return store.ChapterMutation{}, false
	}
	if body.CustomImageID != nil {
		if _, err := s.store.GetActiveUserStorageImage(r.Context(), *body.CustomImageID, userID); err != nil {
			badRequest(w, "Загруженное изображение недоступно")
			return store.ChapterMutation{}, false
		}
	}
	if !finite(body.PositionX) || !finite(body.PositionY) {
		badRequest(w, "Некорректная позиция главы")
		return store.ChapterMutation{}, false
	}
	description := cleanText(body.Description, 2000)
	return store.ChapterMutation{
		ArcID: body.ArcID, Number: number, Name: name, Description: description,
		Status: body.Status, ImagePresetKey: body.ImagePresetKey, CustomImageID: body.CustomImageID,
		ImageFocalX: clamp01(body.ImageFocalX), ImageFocalY: clamp01(body.ImageFocalY),
		PositionX: body.PositionX, PositionY: body.PositionY,
	}, true
}

func (s *Server) handleCreateChapter(w http.ResponseWriter, r *http.Request) {
	userID, session, ok := s.requireSessionOwner(w, r)
	if !ok {
		return
	}
	var body chapterMutationRequest
	if err := decodeJSON(r, &body); err != nil {
		badRequest(w, "Некорректный запрос")
		return
	}
	mutation, ok := s.chapterMutation(w, r, userID, session.ID, body)
	if !ok {
		return
	}
	chapter, err := s.store.CreateChapter(r.Context(), session.ID, mutation)
	if store.IsUniqueViolation(err) {
		conflict(w, "Глава с таким номером уже есть в этой арке")
		return
	}
	if err != nil {
		serverError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, chapter)
}

func (s *Server) handleUpdateChapter(w http.ResponseWriter, r *http.Request) {
	userID, session, chapter, ok := s.requireOwnedChapter(w, r)
	if !ok {
		return
	}
	var body chapterMutationRequest
	if err := decodeJSON(r, &body); err != nil {
		badRequest(w, "Некорректный запрос")
		return
	}
	mutation, ok := s.chapterMutation(w, r, userID, session.ID, body)
	if !ok {
		return
	}
	if mutation.ArcID != chapter.ArcID {
		badRequest(w, "Для переноса главы используйте действие «Переместить в арку»")
		return
	}
	if err := s.store.UpdateChapter(r.Context(), chapter.ID, mutation); err != nil {
		if store.IsUniqueViolation(err) {
			conflict(w, "Глава с таким номером уже есть в этой арке")
			return
		}
		serverError(w, err)
		return
	}
	updated, err := s.store.GetChapterByID(r.Context(), chapter.ID)
	if err != nil {
		serverError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, updated)
}

func (s *Server) handleMoveChapterPosition(w http.ResponseWriter, r *http.Request) {
	_, _, chapter, ok := s.requireOwnedChapter(w, r)
	if !ok {
		return
	}
	var body struct {
		X float64 `json:"x"`
		Y float64 `json:"y"`
	}
	if err := decodeJSON(r, &body); err != nil || !finite(body.X) || !finite(body.Y) {
		badRequest(w, "Некорректная позиция")
		return
	}
	if err := s.store.UpdateChapterPosition(r.Context(), chapter.ID, body.X, body.Y); err != nil {
		serverError(w, err)
		return
	}
	writeJSON(w, http.StatusNoContent, nil)
}

func (s *Server) handleMoveChapterArc(w http.ResponseWriter, r *http.Request) {
	_, session, chapter, ok := s.requireOwnedChapter(w, r)
	if !ok {
		return
	}
	var body struct {
		ArcID int64   `json:"arcId"`
		X     float64 `json:"x"`
		Y     float64 `json:"y"`
	}
	if err := decodeJSON(r, &body); err != nil || !finite(body.X) || !finite(body.Y) {
		badRequest(w, "Некорректный запрос")
		return
	}
	arc, err := s.store.GetSessionArc(r.Context(), body.ArcID)
	if err != nil || arc.SessionID != session.ID {
		badRequest(w, "Арка не принадлежит сессии")
		return
	}
	if err := s.store.MoveChapterToArc(r.Context(), chapter.ID, arc.ID, body.X, body.Y); err != nil {
		if store.IsUniqueViolation(err) {
			conflict(w, "В целевой арке уже есть глава с таким номером")
			return
		}
		serverError(w, err)
		return
	}
	updated, err := s.store.GetChapterByID(r.Context(), chapter.ID)
	if err != nil {
		serverError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, updated)
}

func (s *Server) handleDeleteChapter(w http.ResponseWriter, r *http.Request) {
	_, session, chapter, ok := s.requireOwnedChapter(w, r)
	if !ok {
		return
	}
	deleted, err := s.store.DeleteChapter(r.Context(), session.ID, chapter.ID)
	if err != nil {
		serverError(w, err)
		return
	}
	if !deleted {
		conflict(w, "Сначала удалите или перенесите сцены этой главы")
		return
	}
	writeJSON(w, http.StatusNoContent, nil)
}

type setCurrentChapterRequest struct {
	ChapterID *int64 `json:"chapterId"`
}

func (s *Server) handleSetCurrentChapter(w http.ResponseWriter, r *http.Request) {
	userID, session, ok := s.requireSessionOwner(w, r)
	if !ok {
		return
	}
	var body setCurrentChapterRequest
	if err := decodeJSON(r, &body); err != nil {
		badRequest(w, "Некорректный запрос")
		return
	}
	var selectedChapter *store.SessionChapter
	if body.ChapterID != nil {
		chapter, err := s.store.GetChapterByID(r.Context(), *body.ChapterID)
		if err != nil || chapter.SessionID != session.ID {
			badRequest(w, "Глава не принадлежит сессии")
			return
		}
		selectedChapter = &chapter
	}
	if err := s.store.SetCurrentChapter(r.Context(), session.ID, body.ChapterID); err != nil {
		serverError(w, err)
		return
	}
	if selectedChapter != nil && (session.CurrentChapterID == nil || *session.CurrentChapterID != selectedChapter.ID) {
		s.appendSessionEvent(r.Context(), session.ID, userID, "chapter_started", "Группа перешла в другую главу", map[string]any{
			"chapterId": selectedChapter.ID,
			"number":    selectedChapter.Number,
			"name":      selectedChapter.Name,
		})
	}
	writeJSON(w, http.StatusNoContent, nil)
}

func (s *Server) requireSessionOwner(w http.ResponseWriter, r *http.Request) (int64, store.GameSession, bool) {
	userID, ok := mustUser(w, r)
	if !ok {
		return 0, store.GameSession{}, false
	}
	session, err := s.lookupSession(w, r)
	if err != nil {
		return 0, store.GameSession{}, false
	}
	if session.OwnerUserID != userID {
		forbidden(w)
		return 0, store.GameSession{}, false
	}
	return userID, session, true
}

func (s *Server) requireOwnedChapter(w http.ResponseWriter, r *http.Request) (int64, store.GameSession, store.SessionChapter, bool) {
	userID, session, ok := s.requireSessionOwner(w, r)
	if !ok {
		return 0, store.GameSession{}, store.SessionChapter{}, false
	}
	id, err := strconv.ParseInt(r.PathValue("chapterId"), 10, 64)
	if err != nil {
		badRequest(w, "Некорректная глава")
		return 0, store.GameSession{}, store.SessionChapter{}, false
	}
	chapter, err := s.store.GetChapterByID(r.Context(), id)
	if err != nil || chapter.SessionID != session.ID {
		notFound(w, "")
		return 0, store.GameSession{}, store.SessionChapter{}, false
	}
	return userID, session, chapter, true
}

func cleanText(value *string, max int) *string {
	if value == nil {
		return nil
	}
	trimmed := strings.TrimSpace(*value)
	if trimmed == "" {
		return nil
	}
	runes := []rune(trimmed)
	if len(runes) > max {
		trimmed = string(runes[:max])
	}
	return &trimmed
}

func clamp01(value float64) float64 {
	if value < 0 {
		return 0
	}
	if value > 1 {
		return 1
	}
	return value
}

func finite(value float64) bool {
	return !math.IsNaN(value) && !math.IsInf(value, 0)
}
