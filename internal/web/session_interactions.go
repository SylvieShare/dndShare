package web

import (
	"errors"
	"net/http"
	"strconv"
	"strings"

	"dndshare/internal/store"
)

func init() { registerRoutes((*Server).routesSessionInteractions) }
func (s *Server) routesSessionInteractions(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/char/{uuid}/interactions", s.handleCharacterInteractions)
	mux.HandleFunc("POST /api/char/{uuid}/interactions", s.handleCreateCharacterInteraction)
	mux.HandleFunc("POST /api/char/{uuid}/interactions/read", s.handleReadCharacterMessages)
	mux.HandleFunc("POST /api/char/{uuid}/interactions/{eventId}/resolve", s.handleResolveCharacterInteraction)
}

type createInteractionRequest struct {
	SessionUUID       string `json:"sessionUuid"`
	RecipientCharUUID string `json:"recipientCharUuid"`
	ClientActionID    string `json:"clientActionId"`
	Type              string `json:"type"`
	Message           string `json:"message"`
	Choice            string `json:"choice"`
}

func validInteractionRequest(req createInteractionRequest) bool {
	return isUUID(req.SessionUUID) && isUUID(req.RecipientCharUUID) && isUUID(req.ClientActionID) && store.ValidInteraction(req.Type, req.Message, req.Choice)
}

func (s *Server) handleCharacterInteractions(w http.ResponseWriter, r *http.Request) {
	userID, c, ok := s.transferOwner(w, r)
	if !ok {
		return
	}
	sessionUUID, peerUUID := r.URL.Query().Get("sessionUuid"), r.URL.Query().Get("peer")
	before, err := strconv.ParseInt(r.URL.Query().Get("before"), 10, 64)
	if !isUUID(sessionUUID) || (peerUUID != "" && !isUUID(peerUUID)) || (r.URL.Query().Get("before") != "" && (err != nil || before < 0)) {
		badRequest(w, "Некорректная сессия или участник")
		return
	}
	events, err := s.store.CharacterInteractions(r.Context(), userID, c.ID, sessionUUID, peerUUID, before)
	if err != nil {
		interactionError(w, err)
		return
	}
	hasMore := peerUUID != "" && len(events) > 50
	if hasMore {
		events = events[:50]
	}
	writeJSON(w, http.StatusOK, map[string]any{"events": nonNil(events), "hasMore": hasMore})
}

func (s *Server) handleCreateCharacterInteraction(w http.ResponseWriter, r *http.Request) {
	userID, c, ok := s.transferOwner(w, r)
	if !ok {
		return
	}
	var req createInteractionRequest
	if decodeJSON(r, &req) != nil {
		badRequest(w, "Некорректный запрос")
		return
	}
	req.Message = strings.TrimSpace(req.Message)
	if !validInteractionRequest(req) {
		badRequest(w, "Введите сообщение до 2000 символов или выберите камень, ножницы, бумагу")
		return
	}
	session, err := s.store.GetGameSessionByUUID(r.Context(), req.SessionUUID)
	if err != nil {
		interactionError(w, err)
		return
	}
	recipient, err := s.store.GetCharacter(r.Context(), req.RecipientCharUUID)
	if err != nil {
		interactionError(w, err)
		return
	}
	event, err := s.store.CreateCharacterInteraction(r.Context(), userID, session.ID, c.ID, recipient.ID, req.Type, req.Message, req.Choice, req.ClientActionID)
	if err != nil {
		interactionError(w, err)
		return
	}
	s.publishSessionJournal(session.ID)
	writeJSON(w, http.StatusCreated, sessionEventResponse{Event: event})
}

func (s *Server) handleResolveCharacterInteraction(w http.ResponseWriter, r *http.Request) {
	userID, c, ok := s.transferOwner(w, r)
	if !ok {
		return
	}
	id, err := strconv.ParseInt(r.PathValue("eventId"), 10, 64)
	var req struct {
		Decision string `json:"decision"`
	}
	if err != nil || id <= 0 || decodeJSON(r, &req) != nil {
		badRequest(w, "Некорректный ответ")
		return
	}
	event, err := s.store.ResolveCharacterInteraction(r.Context(), userID, c.ID, id, req.Decision)
	if err != nil {
		interactionError(w, err)
		return
	}
	s.publishSessionJournal(event.SessionID)
	writeJSON(w, http.StatusOK, sessionEventResponse{Event: event})
}

func (s *Server) handleReadCharacterMessages(w http.ResponseWriter, r *http.Request) {
	userID, c, ok := s.transferOwner(w, r)
	if !ok {
		return
	}
	var req struct {
		SessionUUID string `json:"sessionUuid"`
		PeerUUID    string `json:"peerUuid"`
		ThroughID   int64  `json:"throughId"`
	}
	if decodeJSON(r, &req) != nil || !isUUID(req.SessionUUID) || !isUUID(req.PeerUUID) || req.ThroughID <= 0 {
		badRequest(w, "Некорректная переписка")
		return
	}
	if err := s.store.ReadCharacterMessages(r.Context(), userID, c.ID, req.ThroughID, req.SessionUUID, req.PeerUUID); err != nil {
		interactionError(w, err)
		return
	}
	session, err := s.store.GetGameSessionByUUID(r.Context(), req.SessionUUID)
	if err == nil {
		s.publishSessionJournal(session.ID)
	}
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

func interactionError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, store.ErrNotFound):
		notFound(w, "Участник или событие сессии не найдены")
	case errors.Is(err, store.ErrInvalidInteraction):
		badRequest(w, err.Error())
	case errors.Is(err, store.ErrInteractionConflict):
		conflict(w, err.Error())
	default:
		serverError(w, err)
	}
}
