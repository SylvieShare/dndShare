package web

import (
	"errors"
	"net/http"
	"strconv"
	"strings"

	"dndshare/internal/store"
)

type chaptersResponse struct {
	Chapters []store.SessionChapter `json:"chapters"`
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

type createChapterRequest struct {
	Name string `json:"name"`
}

func (s *Server) handleCreateChapter(w http.ResponseWriter, r *http.Request) {
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
	var req createChapterRequest
	if err := decodeJSON(r, &req); err != nil {
		badRequest(w, "Некорректный запрос")
		return
	}
	name := strings.TrimSpace(req.Name)
	if name == "" {
		badRequest(w, "")
		return
	}
	chapter, err := s.store.CreateChapter(r.Context(), session.ID, name)
	if err != nil {
		serverError(w, err)
		return
	}
	if err := s.store.UpdateCurrentChapter(r.Context(), session.UUID, &chapter.ID); err != nil {
		serverError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, chapter)
}

type renameChapterRequest struct {
	Name string `json:"name"`
}

func (s *Server) handleRenameChapter(w http.ResponseWriter, r *http.Request) {
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
	chapterID, err := strconv.ParseInt(r.PathValue("chapterId"), 10, 64)
	if err != nil {
		badRequest(w, "Некорректный запрос")
		return
	}
	chapter, err := s.store.GetChapterByID(r.Context(), chapterID)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			notFound(w, "")
			return
		}
		serverError(w, err)
		return
	}
	if chapter.SessionID != session.ID {
		badRequest(w, "")
		return
	}
	var body renameChapterRequest
	if err := decodeJSON(r, &body); err != nil {
		badRequest(w, "Некорректный запрос")
		return
	}
	name := strings.TrimSpace(body.Name)
	if name == "" {
		badRequest(w, "")
		return
	}
	if err := s.store.RenameChapter(r.Context(), chapterID, name); err != nil {
		serverError(w, err)
		return
	}
	updated, err := s.store.GetChapterByID(r.Context(), chapterID)
	if err != nil {
		serverError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, updated)
}

type setCurrentChapterRequest struct {
	ChapterID *int64 `json:"chapterId"`
}

func (s *Server) handleSetCurrentChapter(w http.ResponseWriter, r *http.Request) {
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
	var body setCurrentChapterRequest
	if err := decodeJSON(r, &body); err != nil {
		badRequest(w, "Некорректный запрос")
		return
	}
	if body.ChapterID != nil {
		chapter, err := s.store.GetChapterByID(r.Context(), *body.ChapterID)
		if err != nil {
			if errors.Is(err, store.ErrNotFound) {
				notFound(w, "")
				return
			}
			serverError(w, err)
			return
		}
		if chapter.SessionID != session.ID {
			badRequest(w, "")
			return
		}
	}
	if err := s.store.UpdateCurrentChapter(r.Context(), session.UUID, body.ChapterID); err != nil {
		serverError(w, err)
		return
	}
	writeJSON(w, http.StatusNoContent, nil)
}
