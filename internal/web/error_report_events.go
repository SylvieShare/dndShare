package web

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"time"
)

func init() { registerRoutes((*Server).routesErrorReportEvents) }

func (s *Server) routesErrorReportEvents(mux *http.ServeMux) {
	mux.HandleFunc("GET /mcp/error-report-events", s.handleErrorReportEvents)
}

func (s *Server) handleErrorReportEvents(w http.ResponseWriter, r *http.Request) {
	if !s.mcpAuthorized(r) {
		w.WriteHeader(http.StatusUnauthorized)
		return
	}
	value := r.URL.Query().Get("after")
	if value == "" {
		value = r.Header.Get("Last-Event-ID")
	}
	var cursor int64
	if value != "" {
		var err error
		cursor, err = strconv.ParseInt(value, 10, 64)
		if err != nil || cursor < 0 {
			badRequest(w, "after must be a non-negative event ID")
			return
		}
	}
	flusher, ok := w.(http.Flusher)
	if !ok {
		serverError(w, fmt.Errorf("SSE flushing is unavailable"))
		return
	}
	controller := http.NewResponseController(w)
	defer controller.SetWriteDeadline(time.Time{})
	events, err := s.store.ListErrorReportEvents(r.Context(), cursor, 100)
	if err != nil {
		serverError(w, err)
		return
	}
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "private, no-store")
	w.Header().Set("X-Accel-Buffering", "no")
	_ = controller.SetWriteDeadline(time.Now().Add(30 * time.Second))
	if _, err := fmt.Fprint(w, "retry: 1000\n: connected\n\n"); err != nil {
		return
	}
	flusher.Flush()
	poll := time.NewTicker(time.Second)
	heartbeat := time.NewTicker(15 * time.Second)
	defer poll.Stop()
	defer heartbeat.Stop()
	for {
		_ = controller.SetWriteDeadline(time.Now().Add(30 * time.Second))
		for _, event := range events {
			data, err := json.Marshal(event)
			if err != nil {
				return
			}
			if _, err := fmt.Fprintf(w, "id: %d\nevent: error-report\ndata: %s\n\n", event.ID, data); err != nil {
				return
			}
			cursor = event.ID
		}
		flusher.Flush()
		if len(events) == 100 {
			events, err = s.store.ListErrorReportEvents(r.Context(), cursor, 100)
			if err != nil {
				return
			}
			continue
		}
		select {
		case <-r.Context().Done():
			return
		case <-heartbeat.C:
			if _, err := fmt.Fprint(w, ": heartbeat\n\n"); err != nil {
				return
			}
			flusher.Flush()
		case <-poll.C:
		}
		events, err = s.store.ListErrorReportEvents(r.Context(), cursor, 100)
		if err != nil {
			return
		}
	}
}
