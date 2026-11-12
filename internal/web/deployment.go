package web

import (
	"context"
	"errors"
	"net"
	"net/http"
	"sync"
	"time"
)

// Candidate processes serve health/API traffic but cannot start administrative jobs
// until the previous process has stopped and its interrupted runs are recovered.
type deploymentState struct {
	mu       sync.RWMutex
	disabled bool
	draining chan struct{}
	once     sync.Once
}

var errDeploymentDraining = errors.New("background jobs are temporarily unavailable during deployment")

func (d *deploymentState) beginJob() (func(), bool) {
	d.mu.RLock()
	if d.disabled {
		d.mu.RUnlock()
		return nil, false
	}
	return d.mu.RUnlock, true
}
func (d *deploymentState) activate(recoverJobs func() error) error {
	d.mu.Lock()
	defer d.mu.Unlock()
	if !d.disabled {
		return nil
	}
	if err := recoverJobs(); err != nil {
		return err
	}
	d.disabled = false
	return nil
}
func init() { registerRoutes((*Server).routesDeployment) }
func (s *Server) routesDeployment(mux *http.ServeMux) {
	mux.HandleFunc("POST /internal/deployment/activate", func(w http.ResponseWriter, r *http.Request) {
		host, _, err := net.SplitHostPort(r.RemoteAddr)
		ip := net.ParseIP(host)
		if err != nil || ip == nil || !ip.IsLoopback() || r.Header.Get("X-Forwarded-For") != "" || r.Header.Get("Forwarded") != "" {
			http.NotFound(w, r)
			return
		}
		if r.URL.Query().Get("commit") != currentBuildCommit() {
			http.Error(w, "release changed", http.StatusConflict)
			return
		}
		err = s.deployment.activate(func() error {
			_, err := s.store.MarkRunningJobsFailedAtBoot(r.Context(), "Прервано сменой экземпляра приложения")
			return err
		})
		if err != nil {
			serverError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"active": true, "commitSha": currentBuildCommit()})
	})
}

// Drain closes SSE immediately, then lets HTTP requests and cooperative jobs finish.
func (s *Server) BeginDrain() {
	s.deployment.mu.Lock()
	s.deployment.disabled = true
	s.deployment.once.Do(func() {
		if s.deployment.draining != nil {
			close(s.deployment.draining)
		}
	})
	s.deployment.mu.Unlock()
	s.jobs.mu.Lock()
	for _, job := range s.jobs.active {
		job.cancel.Store(true)
	}
	s.jobs.mu.Unlock()
}
func (s *Server) WaitForJobs(ctx context.Context) error {
	ticker := time.NewTicker(50 * time.Millisecond)
	defer ticker.Stop()
	for {
		s.jobs.mu.Lock()
		count := len(s.jobs.active)
		s.jobs.mu.Unlock()
		if count == 0 {
			return nil
		}
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-ticker.C:
		}
	}
}
