package web

import "net/http"

func init() { registerRoutes((*Server).routesMasterTools) }
func (s *Server) routesMasterTools(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/master-tools/treasure-pool", s.handleTreasurePool)
}

func (s *Server) handleTreasurePool(w http.ResponseWriter, r *http.Request) {
	uid, ok := mustUser(w, r)
	if !ok {
		return
	}
	items, err := s.store.TreasurePool(r.Context(), uid, parseContentScope(r.URL.Query()))
	if err != nil {
		serverError(w, err)
		return
	}
	writeItems(w, items)
}
