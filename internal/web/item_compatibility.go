package web

import (
	"dndshare/internal/store"
	"errors"
	"net/http"
	"strconv"
)

func init() { registerRoutes((*Server).routesItemCompatibility) }
func (s *Server) routesItemCompatibility(mux *http.ServeMux) {
	mux.HandleFunc("PUT /api/items/{id}/compatibility", s.handleSetItemCompatibility)
	mux.HandleFunc("POST /api/items/{id}/variant", s.handleCreateItemVariant)
}
func (s *Server) handleSetItemCompatibility(w http.ResponseWriter, r *http.Request) {
	uid, ok := mustUser(w, r)
	if !ok {
		return
	}
	id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil {
		badRequest(w, "bad id")
		return
	}
	var req struct {
		Compatibility []store.ItemCompatibility `json:"compatibility"`
	}
	if err = decodeJSON(r, &req); err != nil {
		badRequest(w, "bad body")
		return
	}
	admin, ok := s.hasRole(w, r, uid, RoleAdmin, RoleHandbookAdmin)
	if !ok {
		return
	}
	err = s.store.SetItemCompatibility(r.Context(), id, uid, admin, req.Compatibility)
	if errors.Is(err, store.ErrNotFound) {
		notFound(w, "item not found")
		return
	}
	if err != nil {
		serverError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func itemCompatibilityToolSchema() map[string]any {
	return map[string]any{"type": "array", "description": "Explicit rules editions. Omitted on update preserves decisions; an empty array makes the item unreviewed for every edition. native/compatible are selectable; other statuses are browse-only.", "items": map[string]any{
		"type": "object", "required": []string{"sourceVersionId", "status"}, "properties": map[string]any{
			"sourceVersionId":  map[string]any{"type": "integer"},
			"status":           map[string]any{"type": "string", "enum": []string{"native", "compatible", "legacy", "blocked", "requires_adaptation"}},
			"replacedByItemId": map[string]any{"type": "integer", "description": "Available replacement, only for legacy status"},
			"note":             map[string]any{"type": "string"},
		}}}
}

func (s *Server) handleCreateItemVariant(w http.ResponseWriter, r *http.Request) {
	uid, ok := mustUser(w, r)
	if !ok {
		return
	}
	id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil {
		badRequest(w, "bad id")
		return
	}
	var req struct {
		SourceVersionID int64  `json:"sourceVersionId"`
		Kind            string `json:"kind"`
	}
	if err = decodeJSON(r, &req); err != nil || (req.Kind != "revision" && req.Kind != "adaptation") {
		badRequest(w, "Укажите редакцию и тип варианта")
		return
	}
	item, err := s.store.CreateItemVariant(r.Context(), id, uid, req.SourceVersionID, req.Kind)
	if errors.Is(err, store.ErrNotFound) {
		notFound(w, "item or edition not found")
		return
	}
	if err != nil {
		serverError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, item)
}
