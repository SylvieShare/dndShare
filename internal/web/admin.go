package web

import (
	"errors"
	"net/http"
	"strconv"
	"time"

	"dndshare/internal/store"
)

func init() { registerRoutes((*Server).routesAdmin) }

func (s *Server) routesAdmin(mux *http.ServeMux) {
	// admin-panel (пользователи, роли, логи, статистика)
	mux.HandleFunc("GET /api/admin-panel/users", s.handleAdminUsers)
	mux.HandleFunc("POST /api/admin-panel/users/{id}/roles", s.handleAdminAddRole)
	mux.HandleFunc("DELETE /api/admin-panel/users/{id}/roles/{role}", s.handleAdminRemoveRole)
	mux.HandleFunc("POST /api/admin-panel/users/{id}/password", s.handleAdminResetPassword)
	mux.HandleFunc("GET /api/admin-panel/logs", s.handleAdminLogs)
	mux.HandleFunc("DELETE /api/admin-panel/logs/{id}", s.handleAdminDeleteLog)
	mux.HandleFunc("DELETE /api/admin-panel/logs", s.handleAdminDeleteAllLogs)
	mux.HandleFunc("GET /api/admin-panel/stats", s.handleAdminStats)

	// admin-panel/jobs
	mux.HandleFunc("GET /api/admin-panel/jobs/available", s.handleJobsAvailable)
	mux.HandleFunc("GET /api/admin-panel/jobs", s.handleJobsRecent)
	mux.HandleFunc("GET /api/admin-panel/jobs/{id}", s.handleJobGet)
	mux.HandleFunc("POST /api/admin-panel/jobs/{code}/start", s.handleJobStart)
	mux.HandleFunc("POST /api/admin-panel/jobs/{id}/cancel", s.handleJobCancel)
}

// --- admin-panel: users / roles / logs / stats ---

type adminUserDTO struct {
	ID        int64     `json:"id"`
	Login     string    `json:"login"`
	Roles     []string  `json:"roles"`
	CreatedAt time.Time `json:"createdAt"`
}

func (s *Server) handleAdminUsers(w http.ResponseWriter, r *http.Request) {
	if _, ok := s.requireRole(w, r, RoleAdmin); !ok {
		return
	}
	users, err := s.store.ListUsers(r.Context())
	if err != nil {
		serverError(w, err)
		return
	}
	rolesByUser, err := s.store.RolesByAllUsers(r.Context())
	if err != nil {
		serverError(w, err)
		return
	}
	out := make([]adminUserDTO, 0, len(users))
	for _, u := range users {
		out = append(out, adminUserDTO{ID: u.ID, Login: u.Login, Roles: nonNil(rolesByUser[u.ID]), CreatedAt: u.CreatedAt})
	}
	writeJSON(w, http.StatusOK, map[string]any{"users": out})
}

func (s *Server) handleAdminAddRole(w http.ResponseWriter, r *http.Request) {
	if _, ok := s.requireRole(w, r, RoleAdmin); !ok {
		return
	}
	id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil {
		badRequest(w, "bad id")
		return
	}
	var body struct {
		Role string `json:"role"`
	}
	if err := decodeJSON(r, &body); err != nil {
		badRequest(w, "bad body")
		return
	}
	if err := s.store.AddRole(r.Context(), id, body.Role); err != nil {
		serverError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, nil)
}

func (s *Server) handleAdminRemoveRole(w http.ResponseWriter, r *http.Request) {
	if _, ok := s.requireRole(w, r, RoleAdmin); !ok {
		return
	}
	id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil {
		badRequest(w, "bad id")
		return
	}
	if err := s.store.RemoveRole(r.Context(), id, r.PathValue("role")); err != nil {
		serverError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, nil)
}

func (s *Server) handleAdminResetPassword(w http.ResponseWriter, r *http.Request) {
	if _, ok := s.requireRole(w, r, RoleAdmin); !ok {
		return
	}
	id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil {
		badRequest(w, "bad id")
		return
	}
	var body struct {
		Password string `json:"password"`
	}
	if err := decodeJSON(r, &body); err != nil {
		badRequest(w, "bad body")
		return
	}
	if passwordLength := len([]rune(body.Password)); passwordLength < 4 || passwordLength > 256 {
		badRequest(w, "Пароль должен содержать от 4 до 256 символов")
		return
	}
	hash, err := hashPassword(body.Password)
	if err != nil {
		serverError(w, err)
		return
	}
	if err := s.store.UpdateUserPassword(r.Context(), id, hash); err != nil {
		serverError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, nil)
}

func (s *Server) handleAdminLogs(w http.ResponseWriter, r *http.Request) {
	if _, ok := s.requireRole(w, r, RoleAdmin); !ok {
		return
	}
	logs, err := s.store.ListLogs(r.Context())
	if err != nil {
		serverError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"logs": nonNil(logs)})
}

func (s *Server) handleAdminDeleteLog(w http.ResponseWriter, r *http.Request) {
	if _, ok := s.requireRole(w, r, RoleAdmin); !ok {
		return
	}
	id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil {
		badRequest(w, "bad id")
		return
	}
	if err := s.store.DeleteLog(r.Context(), id); err != nil {
		serverError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, nil)
}

func (s *Server) handleAdminDeleteAllLogs(w http.ResponseWriter, r *http.Request) {
	if _, ok := s.requireRole(w, r, RoleAdmin); !ok {
		return
	}
	if err := s.store.DeleteAllLogs(r.Context()); err != nil {
		serverError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, nil)
}

func (s *Server) handleAdminStats(w http.ResponseWriter, r *http.Request) {
	if _, ok := s.requireRole(w, r, RoleAdmin); !ok {
		return
	}
	st, err := s.store.GetAdminStats(r.Context())
	if err != nil {
		serverError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, st)
}

// --- admin-panel/jobs ---

func (s *Server) handleJobsAvailable(w http.ResponseWriter, r *http.Request) {
	if _, ok := s.requireRole(w, r, RoleAdmin); !ok {
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"jobs": s.jobs.listAvailable()})
}

func (s *Server) handleJobsRecent(w http.ResponseWriter, r *http.Request) {
	if _, ok := s.requireRole(w, r, RoleAdmin); !ok {
		return
	}
	runs, err := s.store.RecentJobRuns(r.Context(), 50)
	if err != nil {
		serverError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"runs": nonNil(runs)})
}

func (s *Server) handleJobGet(w http.ResponseWriter, r *http.Request) {
	if _, ok := s.requireRole(w, r, RoleAdmin); !ok {
		return
	}
	id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil {
		badRequest(w, "bad id")
		return
	}
	run, err := s.store.GetJobRun(r.Context(), id)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			http.NotFound(w, r)
			return
		}
		serverError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, run)
}

func (s *Server) handleJobStart(w http.ResponseWriter, r *http.Request) {
	uid, ok := s.requireRole(w, r, RoleAdmin)
	if !ok {
		return
	}
	run, known, err := s.jobs.start(r.Context(), r.PathValue("code"), uid)
	if err != nil {
		if errors.Is(err, errJobAlreadyRunning) {
			conflict(w, "Джоба уже выполняется")
			return
		}
		serverError(w, err)
		return
	}
	if !known {
		notFound(w, "unknown job")
		return
	}
	writeJSON(w, http.StatusOK, run)
}

func (s *Server) handleJobCancel(w http.ResponseWriter, r *http.Request) {
	if _, ok := s.requireRole(w, r, RoleAdmin); !ok {
		return
	}
	id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil {
		badRequest(w, "bad id")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"cancelled": s.jobs.cancel(id)})
}
