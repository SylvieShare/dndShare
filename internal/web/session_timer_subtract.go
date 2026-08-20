package web

import (
	"errors"
	"net/http"

	"dndshare/internal/store"
)

func init() { registerRoutes((*Server).routesSessionTimerSubtract) }

func (s *Server) routesSessionTimerSubtract(mux *http.ServeMux) {
	mux.HandleFunc("PATCH /api/sessions/{uuid}/timers/{timerId}/subtract", s.handleSubtractSessionTimer)
}

type subtractSessionTimerRequest struct {
	AmountMS int64 `json:"amountMs"`
}

func validSessionTimerSubtractAmount(amountMS int64) bool {
	return amountMS >= 1_000 && amountMS <= 3_600_000
}

func (s *Server) handleSubtractSessionTimer(w http.ResponseWriter, r *http.Request) {
	userID, ok := mustUser(w, r)
	if !ok {
		return
	}
	session, ok := s.requireSceneDm(w, r, userID)
	if !ok {
		return
	}
	timerID, ok := parseSessionTimerID(w, r)
	if !ok {
		return
	}
	var req subtractSessionTimerRequest
	if decodeJSON(r, &req) != nil || !validSessionTimerSubtractAmount(req.AmountMS) {
		badRequest(w, "За один раз можно убрать от секунды до часа")
		return
	}
	timer, err := s.store.SubtractSessionTimerTime(r.Context(), session.ID, timerID, req.AmountMS)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			notFound(w, "Таймер не найден")
		} else {
			serverError(w, err)
		}
		return
	}
	s.displayEvents.publish(session.ID)
	writeSessionTimer(w, timer)
}
