package web

import (
	"errors"
	"io"
	"log"
	"net/http"
	"strconv"
	"strings"

	"dndshare/internal/store"
)

func init() { registerRoutes((*Server).routesSuggests) }

func (s *Server) routesSuggests(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/suggest/types", s.handleSuggestTypes)
	mux.HandleFunc("GET /api/suggest/search", s.handleSuggestSearch)
	mux.HandleFunc("GET /api/suggest/batch", s.handleSuggestBatch)
	mux.HandleFunc("GET /api/suggest/{typeId}", s.handleSuggestByType)
	mux.HandleFunc("GET /api/suggest/{typeId}/items", s.handleSuggestByIds)
	mux.HandleFunc("POST /api/suggest/{typeId}", s.handleSuggestAdd)
	mux.HandleFunc("PUT /api/suggest/{typeId}/{id}", s.handleSuggestUpdate)
	mux.HandleFunc("POST /api/suggest/{typeId}/{id}/svg", s.handleSuggestUploadSvg)
	mux.HandleFunc("POST /api/suggest/{typeId}/{id}/make-base", s.handleSuggestMakeBase)
	mux.HandleFunc("DELETE /api/suggest/{typeId}/{id}", s.handleSuggestDelete)
}

// GET /api/suggest/types — типы подсказок (опционально фильтр по sourceId).
func (s *Server) handleSuggestTypes(w http.ResponseWriter, r *http.Request) {
	sourceID := optionalInt64Query(r, "sourceId")
	items, err := s.store.GetAllSuggestTypes(r.Context(), sourceID)
	if err != nil {
		serverError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": nonNil(items)})
}

// GET /api/suggest/search — поиск подсказок по подстроке value.
func (s *Server) handleSuggestSearch(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query().Get("q")
	if strings.TrimSpace(q) == "" {
		writeJSON(w, http.StatusOK, map[string]any{"items": []store.Suggest{}, "types": []store.SuggestType{}})
		return
	}
	limit := 20
	if v := r.URL.Query().Get("limit"); v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			limit = n
		}
	}
	if limit < 1 {
		limit = 1
	} else if limit > 100 {
		limit = 100
	}
	userID := optionalUserPtr(r)
	items, err := s.store.SearchSuggestsByName(r.Context(), q, userID, limit)
	if err != nil {
		serverError(w, err)
		return
	}
	typeIDs := map[int64]bool{}
	for _, it := range items {
		typeIDs[it.TypeID] = true
	}
	allTypes, err := s.store.GetAllSuggestTypes(r.Context(), nil)
	if err != nil {
		serverError(w, err)
		return
	}
	types := []store.SuggestType{}
	for _, t := range allTypes {
		if typeIDs[t.ID] {
			types = append(types, t)
		}
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": nonNil(items), "types": types})
}

// GET /api/suggest/batch — подсказки по нескольким типам, сгруппированные по typeId.
func (s *Server) handleSuggestBatch(w http.ResponseWriter, r *http.Request) {
	typeIDs := int64ListQuery(r, "typeIds")
	userID := optionalUserPtr(r)
	items, err := s.store.GetSuggestsByTypes(r.Context(), typeIDs, userID)
	if err != nil {
		serverError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": items})
}

// GET /api/suggest/{typeId} — подсказки типа (базовые + собственные).
func (s *Server) handleSuggestByType(w http.ResponseWriter, r *http.Request) {
	typeID, ok := pathInt64(w, r, "typeId")
	if !ok {
		return
	}
	userID := optionalUserPtr(r)
	items, err := s.store.GetSuggestsByType(r.Context(), typeID, userID)
	if err != nil {
		serverError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": nonNil(items)})
}

// GET /api/suggest/{typeId}/items — подсказки типа с заданными id.
func (s *Server) handleSuggestByIds(w http.ResponseWriter, r *http.Request) {
	typeID, ok := pathInt64(w, r, "typeId")
	if !ok {
		return
	}
	ids := int64ListQuery(r, "ids")
	items, err := s.store.GetSuggestsByIds(r.Context(), typeID, ids, optionalUserPtr(r))
	if err != nil {
		serverError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": nonNil(items)})
}

type suggestAddRequest struct {
	Value string  `json:"value"`
	Code  *string `json:"code"`
	Color *string `json:"color"`
	Desc  *string `json:"desc"`
}

// POST /api/suggest/{typeId} — добавить пользовательскую подсказку.
func (s *Server) handleSuggestAdd(w http.ResponseWriter, r *http.Request) {
	typeID, ok := pathInt64(w, r, "typeId")
	if !ok {
		return
	}
	uid, ok := mustUser(w, r)
	if !ok {
		return
	}
	var req suggestAddRequest
	if err := decodeJSON(r, &req); err != nil {
		badRequest(w, "Некорректный запрос")
		return
	}
	item, err := s.store.AddSuggest(r.Context(), typeID, uid, req.Value, req.Code, req.Color, req.Desc)
	if err != nil {
		serverError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, item)
}

type suggestUpdateRequest struct {
	Value      string  `json:"value"`
	Code       *string `json:"code"`
	Color      *string `json:"color"`
	Desc       *string `json:"desc"`
	Svg        *string `json:"svg"`
	SvgID      *int64  `json:"svgId"`
	SvgChanged bool    `json:"svgChanged"`
}

// PUT /api/suggest/{typeId}/{id} — обновить подсказку (владелец или HANDBOOK_ADMIN).
func (s *Server) handleSuggestUpdate(w http.ResponseWriter, r *http.Request) {
	typeID, ok := pathInt64(w, r, "typeId")
	if !ok {
		return
	}
	id, ok := pathInt64(w, r, "id")
	if !ok {
		return
	}
	uid, ok := mustUser(w, r)
	if !ok {
		return
	}
	var req suggestUpdateRequest
	if err := decodeJSON(r, &req); err != nil {
		badRequest(w, "Некорректный запрос")
		return
	}
	isAdmin, err := s.suggestUserHasRole(r, uid, RoleHandbookAdmin)
	if err != nil {
		serverError(w, err)
		return
	}
	old, err := s.store.GetEditableSuggest(r.Context(), id, typeID, uid, isAdmin)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			unauthorized(w)
			return
		}
		serverError(w, err)
		return
	}
	svgID := old.SvgID
	if req.SvgChanged {
		svgID = req.SvgID
	}
	svgSwapped := req.SvgChanged && !int64PtrEqual(svgID, old.SvgID)
	if svgSwapped && svgID != nil {
		if _, err := s.store.GetSuggestSvgData(r.Context(), *svgID); err != nil {
			if errors.Is(err, store.ErrNotFound) {
				badRequest(w, "SVG not found")
				return
			}
			serverError(w, err)
			return
		}
	}
	if err := s.store.UpdateSuggest(r.Context(), id, typeID, uid, isAdmin, req.Value, req.Code, req.Color, req.Desc, svgID); err != nil {
		serverError(w, err)
		return
	}
	if svgSwapped && old.SvgID != nil {
		if err := s.store.DeleteSuggestSvg(r.Context(), *old.SvgID); err != nil {
			log.Printf("delete suggest svg %d: %v", *old.SvgID, err)
		}
	}
	updated, err := s.store.GetEditableSuggest(r.Context(), id, typeID, uid, isAdmin)
	if err != nil {
		updated = old
	}
	writeJSON(w, http.StatusOK, updated)
}

// POST /api/suggest/{typeId}/{id}/svg — загрузить SVG для подсказки (multipart).
func (s *Server) handleSuggestUploadSvg(w http.ResponseWriter, r *http.Request) {
	typeID, ok := pathInt64(w, r, "typeId")
	if !ok {
		return
	}
	id, ok := pathInt64(w, r, "id")
	if !ok {
		return
	}
	uid, ok := mustUser(w, r)
	if !ok {
		return
	}
	isAdmin, err := s.suggestUserHasRole(r, uid, RoleHandbookAdmin)
	if err != nil {
		serverError(w, err)
		return
	}
	if _, err := s.store.GetEditableSuggest(r.Context(), id, typeID, uid, isAdmin); err != nil {
		if errors.Is(err, store.ErrNotFound) {
			unauthorized(w)
			return
		}
		serverError(w, err)
		return
	}
	r.Body = http.MaxBytesReader(w, r.Body, 2<<20)
	if err := r.ParseMultipartForm(1 << 20); err != nil {
		badRequest(w, "Некорректный запрос")
		return
	}
	file, header, err := r.FormFile("file")
	if err != nil {
		badRequest(w, "Некорректный запрос")
		return
	}
	defer file.Close()
	isSvg := header.Header.Get("Content-Type") == "image/svg+xml" ||
		strings.HasSuffix(strings.ToLower(header.Filename), ".svg")
	if !isSvg {
		badRequest(w, "Only SVG files are allowed")
		return
	}
	if header.Size > 512*1024 {
		badRequest(w, "SVG file is too large")
		return
	}
	data, err := io.ReadAll(file)
	if err != nil {
		serverError(w, err)
		return
	}
	svgID, err := s.store.SaveOwnedSuggestSvg(
		r.Context(), uid, string(data), safeUploadFileName(header.Filename), "image/svg+xml", int64(len(data)),
	)
	if err != nil {
		serverError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"svg_id": svgID})
}

// POST /api/suggest/{typeId}/{id}/make-base — сделать подсказку базовой (только HANDBOOK_ADMIN).
func (s *Server) handleSuggestMakeBase(w http.ResponseWriter, r *http.Request) {
	typeID, ok := pathInt64(w, r, "typeId")
	if !ok {
		return
	}
	id, ok := pathInt64(w, r, "id")
	if !ok {
		return
	}
	uid, ok := s.requireRole(w, r, RoleHandbookAdmin)
	if !ok {
		return
	}
	if err := s.store.MakeBaseSuggest(r.Context(), id, typeID); err != nil {
		serverError(w, err)
		return
	}
	updated, err := s.store.GetEditableSuggest(r.Context(), id, typeID, uid, true)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			writeJSON(w, http.StatusNoContent, nil)
			return
		}
		serverError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, updated)
}

// DELETE /api/suggest/{typeId}/{id} — удалить подсказку (владелец или HANDBOOK_ADMIN).
func (s *Server) handleSuggestDelete(w http.ResponseWriter, r *http.Request) {
	typeID, ok := pathInt64(w, r, "typeId")
	if !ok {
		return
	}
	id, ok := pathInt64(w, r, "id")
	if !ok {
		return
	}
	uid, ok := mustUser(w, r)
	if !ok {
		return
	}
	isAdmin, err := s.suggestUserHasRole(r, uid, RoleHandbookAdmin)
	if err != nil {
		serverError(w, err)
		return
	}
	suggest, err := s.store.GetEditableSuggest(r.Context(), id, typeID, uid, isAdmin)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			unauthorized(w)
			return
		}
		serverError(w, err)
		return
	}
	deleted, err := s.store.DeleteSuggest(r.Context(), id, typeID, uid, isAdmin)
	if err != nil {
		serverError(w, err)
		return
	}
	if deleted && suggest.SvgID != nil {
		if err := s.store.DeleteSuggestSvg(r.Context(), *suggest.SvgID); err != nil {
			log.Printf("delete suggest svg %d: %v", *suggest.SvgID, err)
		}
	}
	writeJSON(w, http.StatusNoContent, nil)
}

// suggestUserHasRole — есть ли у пользователя роль (без записи 401, в отличие от requireRole).
func (s *Server) suggestUserHasRole(r *http.Request, userID int64, role string) (bool, error) {
	roles, err := s.store.RolesByUser(r.Context(), userID)
	if err != nil {
		return false, err
	}
	for _, rr := range roles {
		if rr == role {
			return true, nil
		}
	}
	return false, nil
}

// optionalUserPtr — id пользователя как *int64 (nil, если не авторизован) для store-методов.
func optionalUserPtr(r *http.Request) *int64 {
	if uid, ok := optionalUser(r); ok {
		return &uid
	}
	return nil
}

// pathInt64 разбирает числовой path-параметр или отвечает 400.
func pathInt64(w http.ResponseWriter, r *http.Request, name string) (int64, bool) {
	v, err := strconv.ParseInt(r.PathValue(name), 10, 64)
	if err != nil {
		badRequest(w, "bad "+name)
		return 0, false
	}
	return v, true
}

// optionalInt64Query — числовой query-параметр как *int64 (nil, если отсутствует/пуст).
func optionalInt64Query(r *http.Request, name string) *int64 {
	v := r.URL.Query().Get(name)
	if v == "" {
		return nil
	}
	n, err := strconv.ParseInt(v, 10, 64)
	if err != nil {
		return nil
	}
	return &n
}

// int64ListQuery читает список чисел из query: повторяющиеся ключи и/или значения через запятую.
func int64ListQuery(r *http.Request, name string) []int64 {
	var out []int64
	for _, raw := range r.URL.Query()[name] {
		for _, part := range strings.Split(raw, ",") {
			part = strings.TrimSpace(part)
			if part == "" {
				continue
			}
			if n, err := strconv.ParseInt(part, 10, 64); err == nil {
				out = append(out, n)
			}
		}
	}
	return out
}
