package web

import (
	"errors"
	"net/http"
	"strconv"

	"dndshare/internal/store"
)

type sessionByCodeResponse struct {
	UUID          string  `json:"uuid"`
	Name          string  `json:"name"`
	Description   *string `json:"description,omitempty"`
	Status        string  `json:"status"`
	SystemName    *string `json:"systemName,omitempty"`
	ChapterNumber *string `json:"chapterNumber,omitempty"`
	ChapterName   *string `json:"chapterName,omitempty"`
	ArcOrder      *int    `json:"arcOrder,omitempty"`
	ArcName       *string `json:"arcName,omitempty"`
}

func (s *Server) handleGetSessionByCode(w http.ResponseWriter, r *http.Request) {
	if _, ok := mustUser(w, r); !ok {
		return
	}
	code := r.PathValue("code")
	session, err := s.store.GetGameSessionByInviteCode(r.Context(), code)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			notFound(w, "")
			return
		}
		serverError(w, err)
		return
	}
	resp := sessionByCodeResponse{
		UUID:        session.UUID,
		Name:        session.Name,
		Description: session.Description,
		Status:      session.Status,
		SystemName:  session.SystemName,
	}
	if session.CurrentChapterID != nil {
		chapter, err := s.store.GetChapterByID(r.Context(), *session.CurrentChapterID)
		if err == nil {
			resp.ChapterNumber = &chapter.Number
			resp.ChapterName = &chapter.Name
			resp.ArcOrder = &chapter.ArcOrder
			resp.ArcName = &chapter.ArcName
		} else if !errors.Is(err, store.ErrNotFound) {
			serverError(w, err)
			return
		}
	}
	writeJSON(w, http.StatusOK, resp)
}

type joinSessionRequest struct {
	CharID int64 `json:"charId"`
}

func (s *Server) handleJoinSession(w http.ResponseWriter, r *http.Request) {
	userID, ok := mustUser(w, r)
	if !ok {
		return
	}
	session, err := s.lookupSession(w, r)
	if err != nil {
		return
	}
	var body joinSessionRequest
	if err := decodeJSON(r, &body); err != nil {
		badRequest(w, "Некорректный запрос")
		return
	}
	owned, err := s.store.IsCharOwnedBy(r.Context(), body.CharID, userID)
	if err != nil {
		serverError(w, err)
		return
	}
	if !owned {
		forbidden(w)
		return
	}
	if err := s.store.AddSessionParticipant(r.Context(), session.ID, body.CharID, userID); err != nil {
		serverError(w, err)
		return
	}
	writeJSON(w, http.StatusNoContent, nil)
}

type updateSessionRequest struct {
	Name        string  `json:"name"`
	Description *string `json:"description"`
}

func (s *Server) handleUpdateSession(w http.ResponseWriter, r *http.Request) {
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
	var body updateSessionRequest
	if err := decodeJSON(r, &body); err != nil {
		badRequest(w, "Некорректный запрос")
		return
	}
	if err := s.store.UpdateSession(r.Context(), session.UUID, body.Name, body.Description); err != nil {
		serverError(w, err)
		return
	}
	writeJSON(w, http.StatusNoContent, nil)
}

func (s *Server) handleKickParticipant(w http.ResponseWriter, r *http.Request) {
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
	charID, err := strconv.ParseInt(r.PathValue("charId"), 10, 64)
	if err != nil {
		badRequest(w, "Некорректный запрос")
		return
	}
	if err := s.store.RemoveSessionParticipantByCharID(r.Context(), session.ID, charID); err != nil {
		serverError(w, err)
		return
	}
	writeJSON(w, http.StatusNoContent, nil)
}

type updateStatusRequest struct {
	Status string `json:"status"`
}

func (s *Server) handleUpdateSessionStatus(w http.ResponseWriter, r *http.Request) {
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
	var body updateStatusRequest
	if err := decodeJSON(r, &body); err != nil {
		badRequest(w, "Некорректный запрос")
		return
	}
	if err := s.store.UpdateSessionStatus(r.Context(), session.UUID, body.Status); err != nil {
		serverError(w, err)
		return
	}
	writeJSON(w, http.StatusNoContent, nil)
}
