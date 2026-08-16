package web

import (
	"errors"
	"fmt"
	"net/http"
	"sync"
	"time"

	"dndshare/internal/store"
)

const (
	displayEventHeartbeat  = 20 * time.Second
	displayEventWriteLimit = 10 * time.Second
)

type displayEventHub struct {
	mu          sync.Mutex
	nextID      uint64
	subscribers map[int64]map[chan uint64]struct{}
}

func newDisplayEventHub() *displayEventHub {
	return &displayEventHub{subscribers: make(map[int64]map[chan uint64]struct{})}
}

func (h *displayEventHub) subscribe(sessionID int64) (<-chan uint64, func()) {
	updates := make(chan uint64, 1)
	h.mu.Lock()
	if h.subscribers[sessionID] == nil {
		h.subscribers[sessionID] = make(map[chan uint64]struct{})
	}
	h.subscribers[sessionID][updates] = struct{}{}
	h.mu.Unlock()

	var once sync.Once
	return updates, func() {
		once.Do(func() {
			h.mu.Lock()
			delete(h.subscribers[sessionID], updates)
			if len(h.subscribers[sessionID]) == 0 {
				delete(h.subscribers, sessionID)
			}
			h.mu.Unlock()
			close(updates)
		})
	}
}

func (h *displayEventHub) publish(sessionID int64) {
	h.mu.Lock()
	h.nextID++
	eventID := h.nextID
	for updates := range h.subscribers[sessionID] {
		select {
		case updates <- eventID:
		default:
			// Один сигнал уже ожидает клиента. Он всё равно загрузит последний
			// snapshot, поэтому промежуточные сигналы безопасно объединяются.
		}
	}
	h.mu.Unlock()
}

func (h *displayEventHub) count(sessionID int64) int {
	h.mu.Lock()
	defer h.mu.Unlock()
	return len(h.subscribers[sessionID])
}

func (s *Server) handleGetPresentationConnections(w http.ResponseWriter, r *http.Request) {
	userID, ok := mustUser(w, r)
	if !ok {
		return
	}
	session, ok := s.requireSceneDm(w, r, userID)
	if !ok {
		return
	}
	w.Header().Set("Cache-Control", "no-store")
	writeJSON(w, http.StatusOK, map[string]int{"connectedScreens": s.displayEvents.count(session.ID)})
}

func (s *Server) handlePublicDisplayEvents(w http.ResponseWriter, r *http.Request) {
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
	flusher, ok := w.(http.Flusher)
	if !ok {
		serverError(w, fmt.Errorf("streaming is not supported"))
		return
	}

	updates, unsubscribe := s.displayEvents.subscribe(session.ID)
	defer unsubscribe()

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache, no-transform")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("X-Accel-Buffering", "no")
	w.WriteHeader(http.StatusOK)
	controller := http.NewResponseController(w)
	write := func(payload string) error {
		_ = controller.SetWriteDeadline(time.Now().Add(displayEventWriteLimit))
		if _, err := fmt.Fprint(w, payload); err != nil {
			return err
		}
		flusher.Flush()
		return nil
	}
	if write("retry: 3000\n\n") != nil {
		return
	}

	heartbeat := time.NewTicker(displayEventHeartbeat)
	defer heartbeat.Stop()
	for {
		select {
		case eventID, open := <-updates:
			if !open || write(fmt.Sprintf("id: %d\ndata: refresh\n\n", eventID)) != nil {
				return
			}
		case <-heartbeat.C:
			if write(": keep-alive\n\n") != nil {
				return
			}
		case <-r.Context().Done():
			return
		}
	}
}
