package web

import (
	"encoding/json"
	"net/http"
	"strconv"
	"strings"

	"dndshare/internal/store"
)

func init() { registerRoutes((*Server).routesItems) }

func (s *Server) routesItems(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/sources", s.handleGetSources)
	mux.HandleFunc("GET /api/item-types", s.handleGetItemTypes)
	mux.HandleFunc("GET /api/items", s.handleGetItems)
	mux.HandleFunc("GET /api/items/by-ids", s.handleGetItemsByIds)
	mux.HandleFunc("GET /api/items/children", s.handleGetItemChildren)
	mux.HandleFunc("GET /api/items/search", s.handleSearchItems)
	mux.HandleFunc("GET /api/items/search-multi", s.handleSearchItemsMulti)
	mux.HandleFunc("POST /api/items", s.handleCreateItem)
	mux.HandleFunc("PUT /api/items/{id}", s.handleUpdateItem)
	mux.HandleFunc("POST /api/items/{id}/make-base", s.handleMakeItemBase)
	mux.HandleFunc("DELETE /api/items/{id}", s.handleDeleteItem)
}

func (s *Server) handleGetSources(w http.ResponseWriter, r *http.Request) {
	sources, err := s.store.SourceGetAll(r.Context())
	if err != nil {
		serverError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"sources": nonNil(sources)})
}

func (s *Server) handleGetItemTypes(w http.ResponseWriter, r *http.Request) {
	var sourceID *int64
	if v := r.URL.Query().Get("sourceId"); v != "" {
		id, err := strconv.ParseInt(v, 10, 64)
		if err != nil {
			badRequest(w, "bad sourceId")
			return
		}
		sourceID = &id
	}
	types, err := s.store.ItemTypeGetAll(r.Context(), sourceID)
	if err != nil {
		serverError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"types": nonNil(types)})
}

func (s *Server) handleGetItems(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	typeID, err := strconv.ParseInt(q.Get("typeId"), 10, 64)
	if err != nil {
		badRequest(w, "bad typeId")
		return
	}
	limit := coerceIn(queryInt(q, "limit", 30), 1, 500)
	offset := coerceAtLeast(queryInt(q, "offset", 0), 0)
	filters := parseFilters(q.Get("filters"))
	items, err := s.store.GetByTypeAndUser(r.Context(), typeID, optionalUserPtr(r), limit, offset, filters)
	if err != nil {
		serverError(w, err)
		return
	}
	writeItems(w, items)
}

func (s *Server) handleGetItemsByIds(w http.ResponseWriter, r *http.Request) {
	ids := parseIDList(r.URL.Query().Get("ids"))
	items, err := s.store.GetByIds(r.Context(), ids)
	if err != nil {
		serverError(w, err)
		return
	}
	writeItems(w, items)
}

func (s *Server) handleGetItemChildren(w http.ResponseWriter, r *http.Request) {
	parentID, err := strconv.ParseInt(r.URL.Query().Get("parentId"), 10, 64)
	if err != nil {
		badRequest(w, "bad parentId")
		return
	}
	items, err := s.store.FindChildren(r.Context(), parentID)
	if err != nil {
		serverError(w, err)
		return
	}
	writeItems(w, items)
}

func (s *Server) handleSearchItems(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	typeID, err := strconv.ParseInt(q.Get("typeId"), 10, 64)
	if err != nil {
		badRequest(w, "bad typeId")
		return
	}
	if !q.Has("q") {
		badRequest(w, "q required")
		return
	}
	limit := coerceIn(queryInt(q, "limit", 20), 1, 500)
	offset := coerceAtLeast(queryInt(q, "offset", 0), 0)
	filters := parseFilters(q.Get("filters"))
	items, err := s.store.SearchByTypeAndName(r.Context(), typeID, q.Get("q"), optionalUserPtr(r), limit, offset, filters)
	if err != nil {
		serverError(w, err)
		return
	}
	writeItems(w, items)
}

func (s *Server) handleSearchItemsMulti(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	if !q.Has("q") {
		badRequest(w, "q required")
		return
	}
	ids := parseIDList(q.Get("typeIds"))
	items, err := s.store.SearchByTypesAndName(r.Context(), ids, q.Get("q"), optionalUserPtr(r))
	if err != nil {
		serverError(w, err)
		return
	}
	writeItems(w, items)
}

func (s *Server) handleCreateItem(w http.ResponseWriter, r *http.Request) {
	uid, ok := mustUser(w, r)
	if !ok {
		return
	}
	var req struct {
		TypeID   int64           `json:"typeId"`
		Name     string          `json:"name"`
		Data     json.RawMessage `json:"data"`
		ParentID *int64          `json:"parentId"`
	}
	if err := decodeJSON(r, &req); err != nil {
		badRequest(w, "bad body")
		return
	}
	item, err := s.store.Create(r.Context(), uid, req.Name, req.Data, req.TypeID, req.ParentID)
	if err != nil {
		serverError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, item)
}

func (s *Server) handleUpdateItem(w http.ResponseWriter, r *http.Request) {
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
		Name   string          `json:"name"`
		NameEn *string         `json:"nameEn"`
		Data   json.RawMessage `json:"data"`
	}
	if err := decodeJSON(r, &req); err != nil {
		badRequest(w, "bad body")
		return
	}
	isAdmin, ok := s.hasRole(w, r, uid, RoleHandbookAdmin)
	if !ok {
		return
	}
	if err := s.store.Update(r.Context(), id, uid, isAdmin, req.Name, req.NameEn, req.Data); err != nil {
		serverError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) handleMakeItemBase(w http.ResponseWriter, r *http.Request) {
	if _, ok := s.requireRole(w, r, RoleHandbookAdmin); !ok {
		return
	}
	id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil {
		badRequest(w, "bad id")
		return
	}
	if err := s.store.MakeBase(r.Context(), id); err != nil {
		serverError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) handleDeleteItem(w http.ResponseWriter, r *http.Request) {
	uid, ok := mustUser(w, r)
	if !ok {
		return
	}
	id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil {
		badRequest(w, "bad id")
		return
	}
	isAdmin, ok := s.hasRole(w, r, uid, RoleHandbookAdmin)
	if !ok {
		return
	}
	if err := s.store.Delete(r.Context(), id, uid, isAdmin); err != nil {
		serverError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// writeItems отдаёт {"items":[...]} (ItemsResponse). Пустой список → [].
func writeItems(w http.ResponseWriter, items []store.Item) {
	writeJSON(w, http.StatusOK, map[string]any{"items": nonNil(items)})
}

// hasRole вычисляет, есть ли у пользователя роль (аналог userRoleService.checkRoles, без 401).
// Второй bool == false, если запрос ролей упал (ответ уже записан как 500).
func (s *Server) hasRole(w http.ResponseWriter, r *http.Request, uid int64, role string) (bool, bool) {
	roles, err := s.store.RolesByUser(r.Context(), uid)
	if err != nil {
		serverError(w, err)
		return false, false
	}
	for _, rr := range roles {
		if rr == role {
			return true, true
		}
	}
	return false, true
}

func queryInt(q map[string][]string, key string, def int) int {
	vals, ok := q[key]
	if !ok || len(vals) == 0 || vals[0] == "" {
		return def
	}
	n, err := strconv.Atoi(vals[0])
	if err != nil {
		return def
	}
	return n
}

func coerceIn(v, lo, hi int) int {
	if v < lo {
		return lo
	}
	if v > hi {
		return hi
	}
	return v
}

func coerceAtLeast(v, lo int) int {
	if v < lo {
		return lo
	}
	return v
}

func parseIDList(raw string) []int64 {
	out := []int64{}
	for _, part := range strings.Split(raw, ",") {
		if n, err := strconv.ParseInt(strings.TrimSpace(part), 10, 64); err == nil {
			out = append(out, n)
		}
	}
	return out
}

// parseFilters повторяет ItemController.parseFilters: пустое/битое → [], значения-списки
// разворачиваются, тип "boolean" если первое значение bool, иначе "values".
func parseFilters(raw string) []store.ItemFilter {
	if strings.TrimSpace(raw) == "" {
		return nil
	}
	var parsed map[string]any
	if err := json.Unmarshal([]byte(raw), &parsed); err != nil {
		return nil
	}
	out := []store.ItemFilter{}
	for key, value := range parsed {
		var values []any
		switch v := value.(type) {
		case []any:
			for _, e := range v {
				if e != nil {
					values = append(values, e)
				}
			}
		case nil:
			values = nil
		default:
			values = []any{v}
		}
		if len(values) == 0 {
			continue
		}
		fieldType := "values"
		if _, ok := values[0].(bool); ok {
			fieldType = "boolean"
		}
		out = append(out, store.ItemFilter{Key: key, Type: fieldType, Values: values})
	}
	return out
}
