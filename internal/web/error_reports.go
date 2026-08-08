package web

import (
	"encoding/json"
	"net/http"
	"strconv"
	"strings"
	"unicode/utf8"
)

func init() { registerRoutes((*Server).routesErrorReports) }

func (s *Server) routesErrorReports(mux *http.ServeMux) {
	mux.HandleFunc("POST /api/error-reports", s.handleCreateErrorReport)
	mux.HandleFunc("GET /api/admin-panel/error-reports", s.handleAdminErrorReports)
	mux.HandleFunc("DELETE /api/admin-panel/error-reports/{id}", s.handleAdminDeleteErrorReport)
}

type createErrorReportRequest struct {
	Description string          `json:"description"`
	PageURL     string          `json:"pageUrl"`
	Element     json.RawMessage `json:"element"`
}

func (s *Server) handleCreateErrorReport(w http.ResponseWriter, r *http.Request) {
	var body createErrorReportRequest
	if err := decodeJSON(r, &body); err != nil {
		badRequest(w, "Некорректная заявка")
		return
	}

	body.Description = strings.TrimSpace(body.Description)
	body.PageURL = strings.TrimSpace(body.PageURL)
	if body.Description == "" || utf8.RuneCountInString(body.Description) > 4000 {
		badRequest(w, "Описание должно содержать от 1 до 4000 символов")
		return
	}
	if body.PageURL == "" || utf8.RuneCountInString(body.PageURL) > 2048 {
		badRequest(w, "Адрес страницы должен содержать от 1 до 2048 символов")
		return
	}
	if len(body.Element) == 0 || len(body.Element) > 16*1024 {
		badRequest(w, "Некорректное описание элемента")
		return
	}
	var element map[string]any
	if err := json.Unmarshal(body.Element, &element); err != nil || len(element) == 0 {
		badRequest(w, "Элемент должен быть непустым JSON-объектом")
		return
	}
	selector, ok := element["selector"].(string)
	if !ok || strings.TrimSpace(selector) == "" {
		badRequest(w, "У элемента отсутствует selector")
		return
	}

	var userID *int64
	if id, ok := optionalUser(r); ok {
		userID = &id
	}
	report, err := s.store.CreateErrorReport(r.Context(), body.Description, body.PageURL, body.Element, userID)
	if err != nil {
		serverError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, report)
}

func (s *Server) handleAdminErrorReports(w http.ResponseWriter, r *http.Request) {
	if _, ok := s.requireRole(w, r, RoleAdmin); !ok {
		return
	}
	limit, ok := boundedQueryInt(w, r, "limit", 200, 1, 500)
	if !ok {
		return
	}
	offset, ok := boundedQueryInt(w, r, "offset", 0, 0, 1000000)
	if !ok {
		return
	}
	reports, err := s.store.ListErrorReports(r.Context(), limit, offset)
	if err != nil {
		serverError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"reports": nonNil(reports)})
}

func (s *Server) handleAdminDeleteErrorReport(w http.ResponseWriter, r *http.Request) {
	if _, ok := s.requireRole(w, r, RoleAdmin); !ok {
		return
	}
	id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil || id <= 0 {
		badRequest(w, "bad id")
		return
	}
	deleted, err := s.store.DeleteErrorReport(r.Context(), id)
	if err != nil {
		serverError(w, err)
		return
	}
	if !deleted {
		notFound(w, "Заявка не найдена")
		return
	}
	writeJSON(w, http.StatusOK, nil)
}

func boundedQueryInt(w http.ResponseWriter, r *http.Request, name string, fallback, min, max int) (int, bool) {
	raw := r.URL.Query().Get(name)
	if raw == "" {
		return fallback, true
	}
	value, err := strconv.Atoi(raw)
	if err != nil || value < min || value > max {
		badRequest(w, name+" must be an integer in the allowed range")
		return 0, false
	}
	return value, true
}
