package web

import (
	"errors"
	"net/http"
	"strconv"
	"strings"
	"time"

	"dndshare/internal/store"
)

const (
	minSessionTimerDurationMS int64 = 5_000
	maxSessionTimerDurationMS int64 = 86_400_000
	maxSessionTimerTotalMS    int64 = 604_800_000
	maxSessionTimers                = 12
)

func init() { registerRoutes((*Server).routesSessionTimers) }

func (s *Server) routesSessionTimers(mux *http.ServeMux) {
	mux.HandleFunc("POST /api/sessions/{uuid}/timers", s.handleCreateSessionTimer)
	mux.HandleFunc("PATCH /api/sessions/{uuid}/timers/{timerId}", s.handleUpdateSessionTimer)
	mux.HandleFunc("DELETE /api/sessions/{uuid}/timers/{timerId}", s.handleDeleteSessionTimer)
}

type sessionTimerResponse struct {
	ID          int64  `json:"id"`
	Description string `json:"description"`
	DurationMS  int64  `json:"durationMs"`
	RemainingMS int64  `json:"remainingMs"`
	EndsAt      *int64 `json:"endsAt,omitempty"`
	Paused      bool   `json:"paused"`
	Completed   bool   `json:"completed"`
	CreatedAt   int64  `json:"createdAt"`
	ChangedAt   int64  `json:"changedAt"`
}

type sessionTimersResponse struct {
	Timers     []sessionTimerResponse `json:"timers"`
	ServerTime int64                  `json:"serverTime"`
}

type sessionTimerMutationResponse struct {
	Timer      sessionTimerResponse `json:"timer"`
	ServerTime int64                `json:"serverTime"`
}

func projectSessionTimer(timer store.SessionTimer, now time.Time) sessionTimerResponse {
	remainingMS := int64(0)
	var endsAt *int64
	if timer.Paused {
		if timer.RemainingMS != nil {
			remainingMS = max(0, *timer.RemainingMS)
		}
	} else if timer.EndsAt != nil {
		remainingMS = max(0, timer.EndsAt.Sub(now).Milliseconds())
		value := timer.EndsAt.UnixMilli()
		endsAt = &value
	}
	return sessionTimerResponse{
		ID: timer.ID, Description: timer.Description, DurationMS: timer.DurationMS,
		RemainingMS: remainingMS, EndsAt: endsAt, Paused: timer.Paused, Completed: remainingMS == 0,
		CreatedAt: timer.CreatedAt.UnixMilli(), ChangedAt: timer.ChangedAt.UnixMilli(),
	}
}

func projectSessionTimers(timers []store.SessionTimer, now time.Time) sessionTimersResponse {
	items := make([]sessionTimerResponse, 0, len(timers))
	for _, timer := range timers {
		items = append(items, projectSessionTimer(timer, now))
	}
	return sessionTimersResponse{Timers: items, ServerTime: now.UnixMilli()}
}

func writeSessionTimer(w http.ResponseWriter, timer store.SessionTimer) {
	now := time.Now()
	writeJSON(w, http.StatusOK, sessionTimerMutationResponse{
		Timer: projectSessionTimer(timer, now), ServerTime: now.UnixMilli(),
	})
}

func (s *Server) handleGetSessionTimers(w http.ResponseWriter, r *http.Request) {
	userID, ok := mustUser(w, r)
	if !ok {
		return
	}
	session, ok := s.requireSceneDm(w, r, userID)
	if !ok {
		return
	}
	timers, err := s.store.ListSessionTimers(r.Context(), session.ID)
	if err != nil {
		serverError(w, err)
		return
	}
	now := time.Now()
	writeJSON(w, http.StatusOK, projectSessionTimers(timers, now))
}

type createSessionTimerRequest struct {
	Description string `json:"description"`
	DurationMS  int64  `json:"durationMs"`
}

func (s *Server) handleCreateSessionTimer(w http.ResponseWriter, r *http.Request) {
	userID, ok := mustUser(w, r)
	if !ok {
		return
	}
	session, ok := s.requireSceneDm(w, r, userID)
	if !ok {
		return
	}
	var req createSessionTimerRequest
	if decodeJSON(r, &req) != nil {
		badRequest(w, "Некорректный запрос")
		return
	}
	req.Description = strings.TrimSpace(req.Description)
	if req.Description == "" || len([]rune(req.Description)) > 160 {
		badRequest(w, "Укажите короткое описание таймера")
		return
	}
	if req.DurationMS < minSessionTimerDurationMS || req.DurationMS > maxSessionTimerDurationMS {
		badRequest(w, "Длительность таймера должна быть от 5 секунд до 24 часов")
		return
	}
	timers, err := s.store.ListSessionTimers(r.Context(), session.ID)
	if err != nil {
		serverError(w, err)
		return
	}
	if len(timers) >= maxSessionTimers {
		conflict(w, "Сначала уберите один из активных таймеров")
		return
	}
	timer, err := s.store.CreateSessionTimer(r.Context(), session.ID, req.Description, req.DurationMS)
	if err != nil {
		serverError(w, err)
		return
	}
	writeSessionTimer(w, timer)
}

type updateSessionTimerRequest struct {
	Action   string `json:"action"`
	AmountMS int64  `json:"amountMs"`
}

func parseSessionTimerID(w http.ResponseWriter, r *http.Request) (int64, bool) {
	timerID, err := strconv.ParseInt(r.PathValue("timerId"), 10, 64)
	if err != nil || timerID <= 0 {
		badRequest(w, "Некорректный таймер")
		return 0, false
	}
	return timerID, true
}

func (s *Server) handleUpdateSessionTimer(w http.ResponseWriter, r *http.Request) {
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
	current, err := s.store.GetSessionTimer(r.Context(), session.ID, timerID)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			notFound(w, "Таймер не найден")
		} else {
			serverError(w, err)
		}
		return
	}
	var req updateSessionTimerRequest
	if decodeJSON(r, &req) != nil {
		badRequest(w, "Некорректный запрос")
		return
	}
	var updated store.SessionTimer
	switch req.Action {
	case "pause":
		if current.Paused {
			writeSessionTimer(w, current)
			return
		}
		updated, err = s.store.PauseSessionTimer(r.Context(), session.ID, timerID)
	case "resume":
		if !current.Paused {
			writeSessionTimer(w, current)
			return
		}
		if current.RemainingMS == nil || *current.RemainingMS <= 0 {
			badRequest(w, "Добавьте время перед продолжением таймера")
			return
		}
		updated, err = s.store.ResumeSessionTimer(r.Context(), session.ID, timerID)
	case "add":
		if req.AmountMS < 1_000 || req.AmountMS > 3_600_000 {
			badRequest(w, "За один раз можно добавить от секунды до часа")
			return
		}
		if current.DurationMS+req.AmountMS > maxSessionTimerTotalMS {
			badRequest(w, "Общая длительность таймера не может превышать 7 дней")
			return
		}
		updated, err = s.store.AddSessionTimerTime(r.Context(), session.ID, timerID, req.AmountMS)
	default:
		badRequest(w, "Некорректное действие с таймером")
		return
	}
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			notFound(w, "Таймер не найден")
		} else {
			serverError(w, err)
		}
		return
	}
	writeSessionTimer(w, updated)
}

func (s *Server) handleDeleteSessionTimer(w http.ResponseWriter, r *http.Request) {
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
	if err := s.store.DeleteSessionTimer(r.Context(), session.ID, timerID); err != nil {
		if errors.Is(err, store.ErrNotFound) {
			notFound(w, "Таймер не найден")
		} else {
			serverError(w, err)
		}
		return
	}
	writeJSON(w, http.StatusNoContent, nil)
}
