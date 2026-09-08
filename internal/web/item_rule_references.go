package web

import (
	"dndshare/internal/store"
	"net/http"
	"strconv"
	"strings"
)

func init() { registerRoutes((*Server).routesItemRuleReferences) }
func (s *Server) routesItemRuleReferences(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/items/rule-references", s.handleItemRuleReferences)
}
func (s *Server) handleItemRuleReferences(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	if !store.ValidRuleReferenceKind(q.Get("kind")) {
		badRequest(w, "invalid reference kind")
		return
	}
	ids := map[string]int64{}
	for _, key := range []string{"itemId", "excludeItemId"} {
		if q.Get(key) == "" {
			continue
		}
		value, err := strconv.ParseInt(q.Get(key), 10, 64)
		if err != nil || value < 0 {
			badRequest(w, "invalid "+key)
			return
		}
		ids[key] = value
	}
	refs, err := s.store.FindItemRuleReferences(r.Context(), optionalUserPtr(r), ids["itemId"], ids["excludeItemId"], q.Get("kind"), strings.TrimSpace(q.Get("q")), coerceIn(queryInt(q, "limit", 40), 1, 100), coerceAtLeast(queryInt(q, "offset", 0), 0))
	if err != nil {
		serverError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"references": refs})
}
