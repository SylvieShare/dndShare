package web

import (
	"net/http"
	"strings"

	"dndshare/internal/config"
	"dndshare/internal/storage"
	"dndshare/internal/store"
)

// Server держит зависимости и собирает HTTP-обработчик.
type Server struct {
	cfg   config.Config
	store *store.Store
	s3    *storage.Service
	jobs  *jobRunner
}

// routeRegistrars — реестр функций регистрации маршрутов. Каждый файл-фича добавляет
// свою через registerRoutes() в init(), поэтому server.go не надо трогать при добавлении фич.
var routeRegistrars []func(*Server, *http.ServeMux)

func registerRoutes(f func(*Server, *http.ServeMux)) {
	routeRegistrars = append(routeRegistrars, f)
}

func New(cfg config.Config, st *store.Store, s3 *storage.Service) *Server {
	s := &Server{cfg: cfg, store: st, s3: s3}
	s.jobs = newJobRunner(s)
	return s
}

// Handler собирает роутинг и цепочку middleware.
func (s *Server) Handler() http.Handler {
	mux := http.NewServeMux()
	for _, reg := range routeRegistrars {
		reg(s, mux)
	}
	mux.Handle("/", spaHandler())

	var h http.Handler = mux
	h = s.session(h)   // резолвит userID в контекст (не блокирует)
	h = s.cors(h)      // CORS для vite (dev)
	h = s.recoverer(h) // паника → 500 + запись в logs
	return h
}

// isAPIPath — служебная проверка (некоторые фичи её переиспользуют).
func isAPIPath(p string) bool {
	return strings.HasPrefix(p, "/api/") || strings.HasPrefix(p, "/mcp")
}
