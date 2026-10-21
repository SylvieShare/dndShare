package web

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"sort"
	"strconv"
	"sync"
	"time"
)

const (
	sessionLiveHeartbeat  = 20 * time.Second
	sessionLiveWriteLimit = 10 * time.Second
)

// Producers coalesce committed changes. Each subscriber receives patches of
// its own authorized roster and the changed chronicle rows.
type sessionLiveUpdate struct {
	Inventory        bool                   `json:"inventory,omitempty"`
	Session          bool                   `json:"session,omitempty"`
	Participants     bool                   `json:"participants,omitempty"`
	CharacterIDs     []int64                `json:"characterIds,omitempty"`
	Journal          bool                   `json:"journal,omitempty"`
	ConnectedScreens *int                   `json:"connectedScreens,omitempty"`
	Roster           *sessionRosterUpdate   `json:"roster,omitempty"`
	Chronicle        *sessionEventsResponse `json:"chronicle,omitempty"`
}

type sessionLivePending struct {
	inventory        bool
	eventID          uint64
	session          bool
	participants     bool
	characterIDs     map[int64]struct{}
	journal          bool
	connectedScreens *int
}

type sessionLiveSubscription struct {
	wake    chan struct{}
	pending sessionLivePending
}

type sessionLiveHub struct {
	mu          sync.Mutex
	nextID      uint64
	subscribers map[int64]map[*sessionLiveSubscription]struct{}
}

func newSessionLiveHub() *sessionLiveHub {
	return &sessionLiveHub{subscribers: make(map[int64]map[*sessionLiveSubscription]struct{})}
}

func (h *sessionLiveHub) subscribe(sessionID int64) (*sessionLiveSubscription, func()) {
	subscription := &sessionLiveSubscription{wake: make(chan struct{}, 1)}
	h.mu.Lock()
	if h.subscribers[sessionID] == nil {
		h.subscribers[sessionID] = make(map[*sessionLiveSubscription]struct{})
	}
	h.subscribers[sessionID][subscription] = struct{}{}
	h.mu.Unlock()

	var once sync.Once
	return subscription, func() {
		once.Do(func() {
			h.mu.Lock()
			delete(h.subscribers[sessionID], subscription)
			if len(h.subscribers[sessionID]) == 0 {
				delete(h.subscribers, sessionID)
			}
			h.mu.Unlock()
		})
	}
}

func (h *sessionLiveHub) publish(sessionID int64, update sessionLiveUpdate) {
	if !update.Inventory && !update.Session && !update.Participants && len(update.CharacterIDs) == 0 && !update.Journal && update.ConnectedScreens == nil {
		return
	}
	h.mu.Lock()
	h.nextID++
	for subscription := range h.subscribers[sessionID] {
		pending := &subscription.pending
		pending.eventID = h.nextID
		pending.inventory = pending.inventory || update.Inventory
		pending.session = pending.session || update.Session
		pending.participants = pending.participants || update.Participants
		pending.journal = pending.journal || update.Journal
		if len(update.CharacterIDs) > 0 && pending.characterIDs == nil {
			pending.characterIDs = make(map[int64]struct{}, len(update.CharacterIDs))
		}
		for _, characterID := range update.CharacterIDs {
			pending.characterIDs[characterID] = struct{}{}
		}
		if update.ConnectedScreens != nil {
			count := *update.ConnectedScreens
			pending.connectedScreens = &count
		}
		select {
		case subscription.wake <- struct{}{}:
		default:
		}
	}
	h.mu.Unlock()
}

func (h *sessionLiveHub) drain(subscription *sessionLiveSubscription) (uint64, sessionLiveUpdate) {
	h.mu.Lock()
	defer h.mu.Unlock()
	pending := subscription.pending
	subscription.pending = sessionLivePending{}
	characterIDs := make([]int64, 0, len(pending.characterIDs))
	for characterID := range pending.characterIDs {
		characterIDs = append(characterIDs, characterID)
	}
	sort.Slice(characterIDs, func(i, j int) bool { return characterIDs[i] < characterIDs[j] })
	return pending.eventID, sessionLiveUpdate{
		Inventory: pending.inventory, Session: pending.session, Participants: pending.participants, CharacterIDs: characterIDs,
		Journal: pending.journal, ConnectedScreens: pending.connectedScreens,
	}
}

func (s *Server) publishSessionOverview(sessionID int64) {
	s.sessionLive.publish(sessionID, sessionLiveUpdate{Session: true})
}

func (s *Server) publishSessionParticipants(sessionID int64) {
	s.sessionLive.publish(sessionID, sessionLiveUpdate{Participants: true})
}

func (s *Server) publishSessionCharacter(sessionID, characterID int64) {
	s.sessionLive.publish(sessionID, sessionLiveUpdate{CharacterIDs: []int64{characterID}})
}

func (s *Server) publishCharacterChange(ctx context.Context, characterID int64) {
	if sessionID, attached, err := s.store.SessionIDForCharacter(ctx, characterID); err == nil && attached {
		s.publishSessionCharacter(sessionID, characterID)
	}
}

func (s *Server) publishSessionInventory(sessionID int64, journal bool) {
	s.sessionLive.publish(sessionID, sessionLiveUpdate{Inventory: true, Journal: journal})
}

func (s *Server) publishSessionJournal(sessionID int64) {
	s.sessionLive.publish(sessionID, sessionLiveUpdate{Journal: true})
}

func (s *Server) publishConnectedScreens(sessionID int64) {
	count := s.displayEvents.count(sessionID)
	s.sessionLive.publish(sessionID, sessionLiveUpdate{ConnectedScreens: &count})
}

func (s *Server) handleSessionLive(w http.ResponseWriter, r *http.Request) {
	userID, session, ok := s.requireSessionEventAccess(w, r)
	if !ok {
		return
	}
	flusher, ok := w.(http.Flusher)
	if !ok {
		serverError(w, fmt.Errorf("streaming is not supported"))
		return
	}

	subscription, unsubscribe := s.sessionLive.subscribe(session.ID)
	defer unsubscribe()
	cursor, _ := strconv.ParseInt(r.URL.Query().Get("after"), 10, 64)
	projection := sessionLiveProjection{journalCursor: cursor}
	project := func(update sessionLiveUpdate) (sessionLiveUpdate, error) {
		if update.Session || update.Participants {
			fresh, err := s.store.GetGameSessionByUUID(r.Context(), session.UUID)
			if err != nil {
				return update, err
			}
			session = fresh
		}
		var err error
		if update.Participants || update.Session || len(update.CharacterIDs) > 0 {
			update.Roster, err = projection.participants(r.Context(), s, session, userID)
			if err != nil {
				return update, err
			}
		}
		if update.Journal {
			update.Chronicle, err = projection.chronicle(r.Context(), s, session.ID, userID)
			if err != nil {
				return update, err
			}
		}
		update.Participants = false
		update.CharacterIDs = nil
		update.Journal = false
		return update, nil
	}
	initial, err := project(sessionLiveUpdate{Participants: true, Journal: true})
	if err != nil {
		serverError(w, err)
		return
	}
	if session.OwnerUserID == userID {
		count := s.displayEvents.count(session.ID)
		initial.ConnectedScreens = &count
	}
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache, no-transform")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("X-Accel-Buffering", "no")
	w.WriteHeader(http.StatusOK)
	controller := http.NewResponseController(w)
	write := func(payload string) error {
		_ = controller.SetWriteDeadline(time.Now().Add(sessionLiveWriteLimit))
		if _, err := fmt.Fprint(w, payload); err != nil {
			return err
		}
		flusher.Flush()
		return nil
	}
	if write("retry: 3000\n\n") != nil {
		return
	}
	initialData, _ := json.Marshal(initial)
	if write(fmt.Sprintf("event: update\ndata: %s\n\n", initialData)) != nil {
		return
	}

	stillAllowed := func() bool {
		if session.OwnerUserID == userID {
			return true
		}
		allowed, err := s.store.UserCanAccessSession(r.Context(), session.ID, userID)
		return err == nil && allowed
	}
	heartbeat := time.NewTicker(sessionLiveHeartbeat)
	defer heartbeat.Stop()
	for {
		select {
		case <-subscription.wake:
			eventID, update := s.sessionLive.drain(subscription)
			if update.Participants && !stillAllowed() {
				return
			}
			if session.OwnerUserID != userID {
				update.ConnectedScreens = nil
				update.Inventory = false
			}
			update, err = project(update)
			if err != nil {
				return
			}
			if !update.Inventory && !update.Session && update.Roster == nil && update.Chronicle == nil && update.ConnectedScreens == nil {
				continue
			}
			data, err := json.Marshal(update)
			if err != nil || write(fmt.Sprintf("id: %d\nevent: update\ndata: %s\n\n", eventID, data)) != nil {
				return
			}
		case <-heartbeat.C:
			if !stillAllowed() || write(": keep-alive\n\n") != nil {
				return
			}
		case <-r.Context().Done():
			return
		}
	}
}
