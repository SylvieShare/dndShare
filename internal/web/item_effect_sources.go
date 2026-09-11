package web

import (
	"net/http"
	"strconv"
)

func init() { registerRoutes((*Server).routesItemEffectSources) }
func (s *Server) routesItemEffectSources(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/items/{id}/effect-sources", s.handleItemEffectSources)
}
func (s *Server) handleItemEffectSources(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil || id <= 0 {
		badRequest(w, "invalid effect id")
		return
	}
	q := r.URL.Query()
	refs, err := s.store.FindItemEffectSources(r.Context(), optionalUserPtr(r), id,
		coerceIn(queryInt(q, "limit", 40), 1, 100), coerceAtLeast(queryInt(q, "offset", 0), 0))
	if err != nil {
		serverError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"sources": refs})
}
