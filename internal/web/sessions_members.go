package web

import (
	"errors"
	"net/http"
	"regexp"
	"strconv"
	"strings"

	"dndshare/internal/store"
)

type sessionByCodeResponse struct {
	UUID          string  `json:"uuid"`
	Name          string  `json:"name"`
	Description   *string `json:"description,omitempty"`
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
	CharID          int64 `json:"charId"`
	ReplaceExisting bool  `json:"replaceExisting"`
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
	previousSessionID, previouslyAttached, err := s.store.SessionIDForCharacter(r.Context(), body.CharID)
	if err != nil {
		serverError(w, err)
		return
	}
	if err := s.store.AddSessionParticipant(r.Context(), session.ID, body.CharID, userID, body.ReplaceExisting); err != nil {
		if errors.Is(err, store.ErrCharacterAlreadyInSession) {
			conflict(w, "Персонаж уже привязан к другой сессии")
			return
		}
		serverError(w, err)
		return
	}
	if previouslyAttached && previousSessionID != session.ID {
		s.publishSessionParticipants(previousSessionID)
	}
	s.publishSessionParticipants(session.ID)
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
	s.displayEvents.publish(session.ID)
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
	s.displayEvents.publish(session.ID)
	s.publishSessionParticipants(session.ID)
	writeJSON(w, http.StatusNoContent, nil)
}

type reorderParticipantsRequest struct {
	IDs []int64 `json:"ids"`
}

func (s *Server) handleReorderParticipants(w http.ResponseWriter, r *http.Request) {
	_, session, ok := s.requireSessionOwner(w, r)
	if !ok {
		return
	}
	var body reorderParticipantsRequest
	if err := decodeJSON(r, &body); err != nil || len(body.IDs) == 0 {
		badRequest(w, "Некорректный порядок игроков")
		return
	}
	if err := s.store.ReorderSessionParticipants(r.Context(), session.ID, body.IDs); err != nil {
		if errors.Is(err, store.ErrNotFound) {
			badRequest(w, "Некорректный порядок игроков")
		} else {
			serverError(w, err)
		}
		return
	}
	s.publishSessionParticipants(session.ID)
	writeJSON(w, http.StatusNoContent, nil)
}

var participantColorPattern = regexp.MustCompile(`^#[0-9a-f]{6}$`)

type updateParticipantColorRequest struct {
	Color *string `json:"color"`
}

func normalizeParticipantColor(color *string) (*string, bool) {
	if color == nil {
		return nil, true
	}
	normalized := strings.ToLower(strings.TrimSpace(*color))
	if !participantColorPattern.MatchString(normalized) {
		return nil, false
	}
	return &normalized, true
}

func (s *Server) handleUpdateParticipantColor(w http.ResponseWriter, r *http.Request) {
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
	var body updateParticipantColorRequest
	if err := decodeJSON(r, &body); err != nil {
		badRequest(w, "Некорректный запрос")
		return
	}
	color, valid := normalizeParticipantColor(body.Color)
	if !valid {
		badRequest(w, "Некорректный цвет")
		return
	}
	updated, err := s.store.UpdateSessionParticipantColor(r.Context(), session.ID, charID, color)
	if err != nil {
		serverError(w, err)
		return
	}
	if !updated {
		notFound(w, "")
		return
	}
	s.displayEvents.publish(session.ID)
	s.publishSessionParticipants(session.ID)
	writeJSON(w, http.StatusNoContent, nil)
}
