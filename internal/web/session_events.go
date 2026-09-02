package web

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"strings"

	"dndshare/internal/store"
)

var allowedSessionEventTypes = map[string]bool{
	"dice_roll":          true,
	"rest_completed":     true,
	"spell_used":         true,
	"item_spent":         true,
	"item_added":         true,
	"entry_added":        true,
	"resource_used":      true,
	"feature_state":      true,
	"status_effect":      true,
	"chapter_started":    true,
	"encounter_started":  true,
	"encounter_finished": true,
}

type createSessionEventRequest struct {
	Type           string          `json:"type"`
	Action         string          `json:"action"`
	Data           json.RawMessage `json:"data"`
	ActorCharUUID  *string         `json:"actorCharUuid"`
	ActorItemID    *int64          `json:"actorItemId"`
	ActorName      *string         `json:"actorName"`
	Visibility     string          `json:"visibility"`
	ClientActionID *string         `json:"clientActionId"`
}

type characterSessionEventRequest struct {
	SessionUUID    string          `json:"sessionUuid"`
	Type           string          `json:"type"`
	Action         string          `json:"action"`
	Data           json.RawMessage `json:"data"`
	Visibility     string          `json:"visibility"`
	ClientActionID string          `json:"clientActionId"`
}

type sessionEventResponse struct {
	Event store.SessionEvent `json:"event"`
}

type sessionEventsResponse struct {
	Events []store.SessionEvent `json:"events"`
}

func (s *Server) appendSessionEvent(ctx context.Context, sessionID, userID int64, eventType, action string, data any) {
	raw, err := json.Marshal(data)
	if err != nil {
		return
	}
	if _, err := s.store.CreateSessionEvent(ctx, sessionID, userID, nil, nil, nil, eventType, action, raw, "public", nil); err == nil {
		s.publishSessionJournal(sessionID)
	}
}

func normalizeCharacterSessionEvent(req characterSessionEventRequest) (store.CharacterSessionEvent, bool) {
	req.Type = strings.TrimSpace(req.Type)
	req.Action = strings.TrimSpace(req.Action)
	if !isUUID(req.SessionUUID) || !allowedSessionEventTypes[req.Type] || req.Action == "" || len([]rune(req.Action)) > 255 {
		return store.CharacterSessionEvent{}, false
	}
	if req.ClientActionID == "" || !isUUID(req.ClientActionID) {
		return store.CharacterSessionEvent{}, false
	}
	if len(req.Data) == 0 {
		req.Data = json.RawMessage("{}")
	}
	if !json.Valid(req.Data) {
		return store.CharacterSessionEvent{}, false
	}
	if req.Visibility == "" {
		req.Visibility = "public"
	}
	if req.Visibility != "public" && req.Visibility != "gm" {
		return store.CharacterSessionEvent{}, false
	}
	return store.CharacterSessionEvent{
		SessionUUID: req.SessionUUID, EventType: req.Type, Action: req.Action,
		Data: req.Data, Visibility: req.Visibility, ClientActionID: req.ClientActionID,
	}, true
}

func (s *Server) requireSessionEventAccess(w http.ResponseWriter, r *http.Request) (int64, store.GameSession, bool) {
	userID, ok := mustUser(w, r)
	if !ok {
		return 0, store.GameSession{}, false
	}
	session, err := s.lookupSession(w, r)
	if err != nil {
		return 0, store.GameSession{}, false
	}
	allowed, err := s.store.UserCanAccessSession(r.Context(), session.ID, userID)
	if err != nil {
		serverError(w, err)
		return 0, store.GameSession{}, false
	}
	if !allowed {
		forbidden(w)
		return 0, store.GameSession{}, false
	}
	return userID, session, true
}

func (s *Server) handleGetSessionEvents(w http.ResponseWriter, r *http.Request) {
	userID, session, ok := s.requireSessionEventAccess(w, r)
	if !ok {
		return
	}
	afterID, _ := strconv.ParseInt(r.URL.Query().Get("after"), 10, 64)
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	events, err := s.store.GetSessionEvents(r.Context(), session.ID, userID, afterID, limit)
	if err != nil {
		serverError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, sessionEventsResponse{Events: nonNil(events)})
}

func (s *Server) handleCreateSessionEvent(w http.ResponseWriter, r *http.Request) {
	userID, session, ok := s.requireSessionEventAccess(w, r)
	if !ok {
		return
	}
	var req createSessionEventRequest
	if err := decodeJSON(r, &req); err != nil {
		badRequest(w, "Некорректный запрос")
		return
	}
	req.Type = strings.TrimSpace(req.Type)
	req.Action = strings.TrimSpace(req.Action)
	if !allowedSessionEventTypes[req.Type] || req.Action == "" || len([]rune(req.Action)) > 255 {
		badRequest(w, "Некорректное событие")
		return
	}
	if len(req.Data) == 0 {
		req.Data = json.RawMessage("{}")
	}
	if !json.Valid(req.Data) {
		badRequest(w, "Некорректные данные события")
		return
	}
	visibility := req.Visibility
	if visibility == "" {
		visibility = "public"
	}
	if visibility != "public" && visibility != "gm" {
		badRequest(w, "Некорректная видимость")
		return
	}
	if visibility == "gm" && session.OwnerUserID != userID {
		forbidden(w)
		return
	}
	if req.ClientActionID != nil && !isUUID(*req.ClientActionID) {
		badRequest(w, "Некорректный идентификатор действия")
		return
	}
	if req.ActorCharUUID != nil && !isUUID(*req.ActorCharUUID) {
		badRequest(w, "Некорректный персонаж события")
		return
	}
	if req.ActorCharUUID != nil && req.ActorItemID != nil {
		badRequest(w, "У события не может быть два действующих")
		return
	}
	if req.ActorItemID != nil && session.OwnerUserID != userID {
		forbidden(w)
		return
	}
	var requestedActorName *string
	if req.ActorName != nil {
		name := strings.TrimSpace(*req.ActorName)
		if len([]rune(name)) > 160 {
			badRequest(w, "Некорректное имя участника события")
			return
		}
		if name != "" {
			requestedActorName = &name
		}
	}
	actorCharID, characterName, err := s.store.ResolveSessionActor(r.Context(), session.ID, userID, req.ActorCharUUID)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			forbidden(w)
		} else {
			serverError(w, err)
		}
		return
	}
	actorItemID, itemName, err := s.store.ResolveSessionActorItem(r.Context(), userID, req.ActorItemID)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			forbidden(w)
		} else {
			serverError(w, err)
		}
		return
	}
	actorName := characterName
	if actorCharID == nil && session.OwnerUserID == userID {
		actorName = requestedActorName
		if actorName == nil {
			actorName = itemName
		}
	}
	event, err := s.store.CreateSessionEvent(
		r.Context(), session.ID, userID, actorCharID, actorItemID, actorName, req.Type, req.Action,
		req.Data, visibility, req.ClientActionID,
	)
	if err != nil {
		serverError(w, err)
		return
	}
	s.publishSessionJournal(session.ID)
	writeJSON(w, http.StatusCreated, sessionEventResponse{Event: event})
}
