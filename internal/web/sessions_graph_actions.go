package web

import (
	"net/http"
	"strconv"
	"strings"

	"dndshare/internal/store"
)

type arcMutationRequest struct {
	Name        string  `json:"name"`
	Description *string `json:"description"`
}

func (s *Server) handleCreateArc(w http.ResponseWriter, r *http.Request) {
	_, session, ok := s.requireSessionOwner(w, r)
	if !ok {
		return
	}
	var body arcMutationRequest
	if err := decodeJSON(r, &body); err != nil {
		badRequest(w, "Некорректный запрос")
		return
	}
	name := strings.TrimSpace(body.Name)
	if name == "" || len([]rune(name)) > 160 {
		badRequest(w, "Укажите название арки")
		return
	}
	arc, err := s.store.CreateSessionArc(r.Context(), session.ID, name, cleanText(body.Description, 1000))
	if err != nil {
		serverError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, arc)
}

func (s *Server) handleUpdateArc(w http.ResponseWriter, r *http.Request) {
	_, _, arc, ok := s.requireOwnedArc(w, r)
	if !ok {
		return
	}
	var body arcMutationRequest
	if err := decodeJSON(r, &body); err != nil {
		badRequest(w, "Некорректный запрос")
		return
	}
	name := strings.TrimSpace(body.Name)
	if name == "" || len([]rune(name)) > 160 {
		badRequest(w, "Укажите название арки")
		return
	}
	if err := s.store.UpdateSessionArc(r.Context(), arc.ID, name, cleanText(body.Description, 1000)); err != nil {
		serverError(w, err)
		return
	}
	updated, err := s.store.GetSessionArc(r.Context(), arc.ID)
	if err != nil {
		serverError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, updated)
}

func (s *Server) handleReorderArcs(w http.ResponseWriter, r *http.Request) {
	_, session, ok := s.requireSessionOwner(w, r)
	if !ok {
		return
	}
	var body struct {
		IDs []int64 `json:"ids"`
	}
	if err := decodeJSON(r, &body); err != nil || len(body.IDs) == 0 {
		badRequest(w, "Некорректный порядок арок")
		return
	}
	if err := s.store.ReorderSessionArcs(r.Context(), session.ID, body.IDs); err != nil {
		badRequest(w, "Некорректный порядок арок")
		return
	}
	writeJSON(w, http.StatusNoContent, nil)
}

func (s *Server) handleDeleteArc(w http.ResponseWriter, r *http.Request) {
	_, session, arc, ok := s.requireOwnedArc(w, r)
	if !ok {
		return
	}
	arcs, err := s.store.GetSessionArcs(r.Context(), session.ID)
	if err != nil {
		serverError(w, err)
		return
	}
	if len(arcs) <= 1 {
		conflict(w, "В сессии должна остаться хотя бы одна арка")
		return
	}
	deleted, err := s.store.DeleteEmptySessionArc(r.Context(), arc.ID)
	if err != nil {
		serverError(w, err)
		return
	}
	if !deleted {
		conflict(w, "Сначала перенесите или удалите главы этой арки")
		return
	}
	arcs, _ = s.store.GetSessionArcs(r.Context(), session.ID)
	ids := make([]int64, 0, len(arcs))
	for _, item := range arcs {
		ids = append(ids, item.ID)
	}
	if err := s.store.ReorderSessionArcs(r.Context(), session.ID, ids); err != nil {
		serverError(w, err)
		return
	}
	writeJSON(w, http.StatusNoContent, nil)
}

type edgeMutationRequest struct {
	ArcID         int64   `json:"arcId"`
	FromChapterID int64   `json:"fromChapterId"`
	ToChapterID   int64   `json:"toChapterId"`
	Label         *string `json:"label"`
	Bidirectional bool    `json:"bidirectional"`
}

func (s *Server) handleCreateChapterEdge(w http.ResponseWriter, r *http.Request) {
	_, session, ok := s.requireSessionOwner(w, r)
	if !ok {
		return
	}
	var body edgeMutationRequest
	if err := decodeJSON(r, &body); err != nil {
		badRequest(w, "Некорректный переход")
		return
	}
	if !s.validEdgeMutation(w, r, session.ID, body) {
		return
	}
	edge, err := s.store.CreateChapterEdge(r.Context(), body.ArcID, body.FromChapterID, body.ToChapterID, cleanText(body.Label, 240), body.Bidirectional)
	if store.IsUniqueViolation(err) {
		conflict(w, "Такой переход уже существует")
		return
	}
	if err != nil {
		serverError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, edge)
}

func (s *Server) handleUpdateChapterEdge(w http.ResponseWriter, r *http.Request) {
	_, session, edge, ok := s.requireOwnedEdge(w, r)
	if !ok {
		return
	}
	var body edgeMutationRequest
	if err := decodeJSON(r, &body); err != nil {
		badRequest(w, "Некорректный переход")
		return
	}
	if body.ArcID != edge.ArcID {
		badRequest(w, "Нельзя перенести переход в другую арку")
		return
	}
	if !s.validEdgeMutation(w, r, session.ID, body) {
		return
	}
	if err := s.store.UpdateChapterEdge(r.Context(), edge.ID, body.FromChapterID, body.ToChapterID, cleanText(body.Label, 240), body.Bidirectional); err != nil {
		if store.IsUniqueViolation(err) {
			conflict(w, "Такой переход уже существует")
			return
		}
		serverError(w, err)
		return
	}
	updated, err := s.store.GetChapterEdge(r.Context(), edge.ID)
	if err != nil {
		serverError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, updated)
}

func (s *Server) handleDeleteChapterEdge(w http.ResponseWriter, r *http.Request) {
	_, _, edge, ok := s.requireOwnedEdge(w, r)
	if !ok {
		return
	}
	if err := s.store.DeleteChapterEdge(r.Context(), edge.ID); err != nil {
		serverError(w, err)
		return
	}
	writeJSON(w, http.StatusNoContent, nil)
}

func (s *Server) validEdgeMutation(w http.ResponseWriter, r *http.Request, sessionID int64, body edgeMutationRequest) bool {
	if body.FromChapterID == body.ToChapterID {
		badRequest(w, "Глава не может вести сама в себя")
		return false
	}
	arc, err := s.store.GetSessionArc(r.Context(), body.ArcID)
	if err != nil || arc.SessionID != sessionID {
		badRequest(w, "Арка не принадлежит сессии")
		return false
	}
	from, errFrom := s.store.GetChapterByID(r.Context(), body.FromChapterID)
	to, errTo := s.store.GetChapterByID(r.Context(), body.ToChapterID)
	if errFrom != nil || errTo != nil || from.SessionID != sessionID || to.SessionID != sessionID ||
		from.ArcID != body.ArcID || to.ArcID != body.ArcID {
		badRequest(w, "Переход возможен только внутри одной арки")
		return false
	}
	return true
}

func (s *Server) requireOwnedArc(w http.ResponseWriter, r *http.Request) (int64, store.GameSession, store.SessionArc, bool) {
	userID, session, ok := s.requireSessionOwner(w, r)
	if !ok {
		return 0, store.GameSession{}, store.SessionArc{}, false
	}
	id, err := strconv.ParseInt(r.PathValue("arcId"), 10, 64)
	if err != nil {
		badRequest(w, "Некорректная арка")
		return 0, store.GameSession{}, store.SessionArc{}, false
	}
	arc, err := s.store.GetSessionArc(r.Context(), id)
	if err != nil || arc.SessionID != session.ID {
		notFound(w, "")
		return 0, store.GameSession{}, store.SessionArc{}, false
	}
	return userID, session, arc, true
}

func (s *Server) requireOwnedEdge(w http.ResponseWriter, r *http.Request) (int64, store.GameSession, store.SessionChapterEdge, bool) {
	userID, session, ok := s.requireSessionOwner(w, r)
	if !ok {
		return 0, store.GameSession{}, store.SessionChapterEdge{}, false
	}
	id, err := strconv.ParseInt(r.PathValue("edgeId"), 10, 64)
	if err != nil {
		badRequest(w, "Некорректный переход")
		return 0, store.GameSession{}, store.SessionChapterEdge{}, false
	}
	edge, err := s.store.GetChapterEdge(r.Context(), id)
	if err != nil {
		notFound(w, "")
		return 0, store.GameSession{}, store.SessionChapterEdge{}, false
	}
	arc, err := s.store.GetSessionArc(r.Context(), edge.ArcID)
	if err != nil || arc.SessionID != session.ID {
		notFound(w, "")
		return 0, store.GameSession{}, store.SessionChapterEdge{}, false
	}
	return userID, session, edge, true
}
