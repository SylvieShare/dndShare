package web

import (
	"errors"
	"net/http"
	"strconv"

	"dndshare/internal/store"
)

func init() { registerRoutes((*Server).routesSvg) }

func (s *Server) routesSvg(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/svg/{id}", s.handleGetSvg)
}

// handleGetSvg отдаёт разметку SVG как image/svg+xml (порт SvgController.getSvg).
func (s *Server) handleGetSvg(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil {
		http.NotFound(w, r)
		return
	}
	data, err := s.store.GetSvg(r.Context(), id)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			http.NotFound(w, r)
			return
		}
		serverError(w, err)
		return
	}
	w.Header().Set("Content-Type", "image/svg+xml")
	// SVG загружается пользователями и отдаётся с того же origin — жёсткий CSP не даёт
	// исполнять скрипты/внешние ресурсы внутри картинки (защита от stored XSS).
	w.Header().Set("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'; sandbox")
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte(data))
}
