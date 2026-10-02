package web

import "net/http"

func init() { registerRoutes((*Server).routesInventoryIconPresets) }

func (s *Server) routesInventoryIconPresets(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/inventory/icon-presets", s.handleInventoryIconPresets)
}

func (s *Server) handleInventoryIconPresets(w http.ResponseWriter, r *http.Request) {
	presets, err := s.store.InventoryIconPresets(r.Context())
	if err != nil {
		serverError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"presets": presets})
}
