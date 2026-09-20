package web

import (
	"fmt"
	"net/http"
	"time"
)

func (s *Server) handlePrivateMapEvents(w http.ResponseWriter, r *http.Request) {
	_, sid, ok := s.mapSession(w, r)
	if !ok {
		return
	}
	s.streamMapEvents(w, r, sid)
}
func (s *Server) handlePublicMapEvents(w http.ResponseWriter, r *http.Request) {
	session, ok := s.publicMapSession(w, r)
	if !ok {
		return
	}
	s.streamMapEvents(w, r, session.ID)
}
func (s *Server) streamMapEvents(w http.ResponseWriter, r *http.Request, sid int64) {
	flusher, ok := w.(http.Flusher)
	if !ok {
		serverError(w, fmt.Errorf("streaming unavailable"))
		return
	}
	updates, unsubscribe := s.mapEvents.subscribe(sid)
	defer unsubscribe()
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache, no-transform")
	w.Header().Set("X-Accel-Buffering", "no")
	controller := http.NewResponseController(w)
	write := func(data string) bool {
		_ = controller.SetWriteDeadline(time.Now().Add(displayEventWriteLimit))
		_, err := fmt.Fprint(w, data)
		if err == nil {
			flusher.Flush()
		}
		return err == nil
	}
	if !write("retry: 3000\ndata: refresh\n\n") {
		return
	}
	ticker := time.NewTicker(displayEventHeartbeat)
	defer ticker.Stop()
	for {
		select {
		case id, open := <-updates:
			if !open || !write(fmt.Sprintf("id: %d\ndata: refresh\n\n", id)) {
				return
			}
		case <-ticker.C:
			if !write(": keep-alive\n\n") {
				return
			}
		case <-r.Context().Done():
			return
		}
	}
}
