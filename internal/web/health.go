package web

import (
	"context"
	"net/http"
	"strings"
	"time"
)

// BuildCommit is replaced by deploy/deploy.sh through -ldflags -X.
// Local development intentionally reports "dev".
var BuildCommit = "dev"

func init() { registerRoutes((*Server).routesHealth) }

func (s *Server) routesHealth(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/health", s.handleHealth)
}

type healthResponse struct {
	Status    string `json:"status"`
	CommitSHA string `json:"commitSha"`
}

func (s *Server) handleHealth(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 2*time.Second)
	defer cancel()

	response := healthResponse{Status: "ok", CommitSHA: currentBuildCommit()}
	if err := s.store.Ping(ctx); err != nil {
		response.Status = "unhealthy"
		writeJSON(w, http.StatusServiceUnavailable, response)
		return
	}
	writeJSON(w, http.StatusOK, response)
}

func currentBuildCommit() string {
	commit := strings.TrimSpace(BuildCommit)
	if commit == "" {
		return "dev"
	}
	return commit
}
