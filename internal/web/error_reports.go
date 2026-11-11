package web

import (
	"encoding/json"
	"net/http"
	"strings"
	"unicode/utf8"
)

func init() { registerRoutes((*Server).routesErrorReports) }

func (s *Server) routesErrorReports(mux *http.ServeMux) {
	mux.HandleFunc("POST /api/error-reports", s.handleCreateErrorReport)
	mux.HandleFunc("GET /api/error-report-review/reports", s.handleReviewerErrorReports)
	mux.HandleFunc("GET /api/error-report-review/reports/{id}/screenshot", s.handleReviewerErrorReportScreenshot)
	mux.HandleFunc("GET /api/error-report-review/reports/{id}/viewport-screenshot", s.handleReviewerErrorReportViewportScreenshot)
	mux.HandleFunc("POST /api/error-report-review/reports/{id}/messages", s.handleReviewerAnswerErrorReport)
	mux.HandleFunc("POST /api/error-report-review/reports/{id}/serious-approval", s.handleApproveErrorReportSeriousChange)
	mux.HandleFunc("POST /api/error-report-review/reports/{id}/archive", s.handleReviewerArchiveErrorReport)
	mux.HandleFunc("GET /api/admin-panel/error-reports", s.handleAdminErrorReports)
	mux.HandleFunc("GET /api/admin-panel/error-reports/{id}/screenshot", s.handleAdminErrorReportScreenshot)
	mux.HandleFunc("GET /api/admin-panel/error-reports/{id}/viewport-screenshot", s.handleAdminErrorReportViewportScreenshot)
	mux.HandleFunc("PATCH /api/admin-panel/error-reports/{id}/approval", s.handleAdminSetErrorReportApproval)
	mux.HandleFunc("POST /api/admin-panel/error-reports/{id}/messages", s.handleAdminAnswerErrorReport)
	mux.HandleFunc("POST /api/admin-panel/error-reports/{id}/reopen", s.handleAdminReopenErrorReport)
	mux.HandleFunc("DELETE /api/admin-panel/error-reports/{id}", s.handleAdminDeleteErrorReport)
}

type createErrorReportRequest struct {
	Title              *string         `json:"title,omitempty"`
	Description        string          `json:"description"`
	PageURL            string          `json:"pageUrl"`
	Element            json.RawMessage `json:"element"`
	Screenshot         *string         `json:"screenshot,omitempty"`
	ViewportScreenshot *string         `json:"viewportScreenshot,omitempty"`
}

const maxErrorReportScreenshotBytes = 2 << 20
const maxErrorReportMessageRunes = 4000
const maxErrorReportTitleRunes = 160

func (s *Server) handleCreateErrorReport(w http.ResponseWriter, r *http.Request) {
	var body createErrorReportRequest
	if err := decodeJSON(r, &body); err != nil {
		badRequest(w, "Некорректная заявка")
		return
	}

	body.Description = strings.TrimSpace(body.Description)
	var normalizedTitle *string
	if body.Title != nil && strings.TrimSpace(*body.Title) != "" {
		title, err := normalizeErrorReportTitle(*body.Title)
		if err != nil {
			badRequest(w, err.Error())
			return
		}
		normalizedTitle = &title
	}
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
	screenshot, screenshotContentType, err := decodeErrorReportScreenshot(body.Screenshot)
	if err != nil {
		badRequest(w, err.Error())
		return
	}
	viewportScreenshot, viewportScreenshotContentType, err := decodeErrorReportScreenshot(body.ViewportScreenshot)
	if err != nil {
		badRequest(w, "Скриншот страницы: "+err.Error())
		return
	}

	var userID *int64
	autoApproved := false
	if id, ok := optionalUser(r); ok {
		userID = &id
		var rolesOK bool
		autoApproved, rolesOK = s.hasRole(w, r, id, RoleErrorReportAutoApprove)
		if !rolesOK {
			return
		}
	}
	report, err := s.store.CreateErrorReport(
		r.Context(), normalizedTitle, body.Description, body.PageURL, body.Element,
		screenshot, screenshotContentType,
		viewportScreenshot, viewportScreenshotContentType,
		userID, autoApproved,
	)
	if err != nil {
		serverError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, report)
}

func (s *Server) handleReviewerErrorReports(w http.ResponseWriter, r *http.Request) {
	if _, ok := s.requireAnyRole(w, r, RoleErrorReportReviewer, RoleAdmin); !ok {
		return
	}
	limit, ok := boundedQueryInt(w, r, "limit", 200, 1, 500)
	if !ok {
		return
	}
	reports, err := s.store.ListReviewerErrorReports(r.Context(), limit, 0)
	if err != nil {
		serverError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"reports": nonNil(reports)})
}
