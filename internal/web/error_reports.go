package web

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"unicode/utf8"

	"dndshare/internal/store"
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
	Title              string          `json:"title"`
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
	if strings.TrimSpace(body.Title) == "" {
		body.Title = defaultErrorReportTitle(body.Description)
	}
	normalizedTitle, err := normalizeErrorReportTitle(body.Title)
	if err != nil {
		badRequest(w, err.Error())
		return
	}
	body.Title = normalizedTitle
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
		r.Context(), body.Title, body.Description, body.PageURL, body.Element,
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

func decodeErrorReportScreenshot(dataURL *string) ([]byte, *string, error) {
	if dataURL == nil || strings.TrimSpace(*dataURL) == "" {
		return nil, nil, nil
	}
	value := strings.TrimSpace(*dataURL)
	comma := strings.IndexByte(value, ',')
	if comma < 0 {
		return nil, nil, errors.New("Некорректный формат скриншота")
	}
	header := value[:comma]
	contentType := ""
	switch header {
	case "data:image/jpeg;base64":
		contentType = "image/jpeg"
	case "data:image/png;base64":
		contentType = "image/png"
	case "data:image/webp;base64":
		contentType = "image/webp"
	default:
		return nil, nil, errors.New("Поддерживаются скриншоты JPEG, PNG и WebP")
	}
	encoded := value[comma+1:]
	if base64.StdEncoding.DecodedLen(len(encoded)) > maxErrorReportScreenshotBytes {
		return nil, nil, fmt.Errorf("Скриншот слишком большой (максимум %d МБ)", maxErrorReportScreenshotBytes>>20)
	}
	decoded, err := base64.StdEncoding.DecodeString(encoded)
	if err != nil || len(decoded) == 0 {
		return nil, nil, errors.New("Некорректные данные скриншота")
	}
	if len(decoded) > maxErrorReportScreenshotBytes {
		return nil, nil, fmt.Errorf("Скриншот слишком большой (максимум %d МБ)", maxErrorReportScreenshotBytes>>20)
	}
	if !validScreenshotSignature(contentType, decoded) {
		return nil, nil, errors.New("Данные не соответствуют формату изображения")
	}
	return decoded, &contentType, nil
}

func validScreenshotSignature(contentType string, data []byte) bool {
	switch contentType {
	case "image/jpeg":
		return bytes.HasPrefix(data, []byte{0xff, 0xd8, 0xff})
	case "image/png":
		return bytes.HasPrefix(data, []byte{0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a})
	case "image/webp":
		return len(data) >= 12 && string(data[:4]) == "RIFF" && string(data[8:12]) == "WEBP"
	default:
		return false
	}
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

func (s *Server) handleAdminSetErrorReportApproval(w http.ResponseWriter, r *http.Request) {
	if _, ok := s.requireRole(w, r, RoleAdmin); !ok {
		return
	}
	id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil || id <= 0 {
		badRequest(w, "bad id")
		return
	}
	var body struct {
		Approved *bool `json:"approved"`
	}
	if err := decodeJSON(r, &body); err != nil || body.Approved == nil {
		badRequest(w, "Поле approved обязательно")
		return
	}
	updated, err := s.store.SetErrorReportApproved(r.Context(), id, *body.Approved)
	if err != nil {
		serverError(w, err)
		return
	}
	if !updated {
		notFound(w, "Заявка не найдена")
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"approved": *body.Approved})
}

func (s *Server) handleAdminAnswerErrorReport(w http.ResponseWriter, r *http.Request) {
	adminUserID, ok := s.requireRole(w, r, RoleAdmin)
	if !ok {
		return
	}
	s.handleErrorReportAnswer(w, r, adminUserID)
}

func (s *Server) handleReviewerAnswerErrorReport(w http.ResponseWriter, r *http.Request) {
	reviewerUserID, ok := s.requireAnyRole(w, r, RoleErrorReportReviewer, RoleAdmin)
	if !ok {
		return
	}
	s.handleErrorReportAnswer(w, r, reviewerUserID)
}

func (s *Server) handleErrorReportAnswer(w http.ResponseWriter, r *http.Request, answeringUserID int64) {
	id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil || id <= 0 {
		badRequest(w, "bad id")
		return
	}
	var body struct {
		Message string `json:"message"`
	}
	if err := decodeJSON(r, &body); err != nil {
		badRequest(w, "Некорректный ответ")
		return
	}
	message, err := normalizeErrorReportMessage(body.Message)
	if err != nil {
		badRequest(w, err.Error())
		return
	}
	created, err := s.store.CreateErrorReportAdminAnswer(r.Context(), id, answeringUserID, message)
	if err != nil {
		switch {
		case errors.Is(err, store.ErrNotFound):
			notFound(w, "Заявка не найдена")
		case errors.Is(err, store.ErrErrorReportNotAwaitingAnswer):
			conflict(w, "У заявки нет вопроса, ожидающего ответа")
		default:
			serverError(w, err)
		}
		return
	}
	writeJSON(w, http.StatusCreated, created)
}

func (s *Server) handleApproveErrorReportSeriousChange(w http.ResponseWriter, r *http.Request) {
	adminUserID, ok := s.requireRole(w, r, RoleAdmin)
	if !ok {
		return
	}
	id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil || id <= 0 {
		badRequest(w, "bad id")
		return
	}
	approved, err := s.store.ApproveErrorReportSeriousChange(r.Context(), id, adminUserID)
	if err != nil {
		serverError(w, err)
		return
	}
	if !approved {
		conflict(w, "Заявка не ожидает подтверждения серьёзных изменений")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"waitingForSeriousApproval":     false,
		"seriousChangeApprovedByUserId": adminUserID,
	})
}

func (s *Server) handleReviewerArchiveErrorReport(w http.ResponseWriter, r *http.Request) {
	if _, ok := s.requireAnyRole(w, r, RoleErrorReportReviewer, RoleAdmin); !ok {
		return
	}
	id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil || id <= 0 {
		badRequest(w, "bad id")
		return
	}
	archived, err := s.store.ArchiveResolvedErrorReport(r.Context(), id)
	if err != nil {
		serverError(w, err)
		return
	}
	if !archived {
		conflict(w, "Архивировать можно только завершённую заявку")
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": store.ErrorReportStatusArchived})
}

func (s *Server) handleAdminReopenErrorReport(w http.ResponseWriter, r *http.Request) {
	if _, ok := s.requireRole(w, r, RoleAdmin); !ok {
		return
	}
	id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil || id <= 0 {
		badRequest(w, "bad id")
		return
	}
	reopened, err := s.store.ReopenErrorReport(r.Context(), id)
	if err != nil {
		serverError(w, err)
		return
	}
	if !reopened {
		notFound(w, "Архивная заявка не найдена")
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": store.ErrorReportStatusOpen})
}

func normalizeErrorReportMessage(message string) (string, error) {
	message = strings.TrimSpace(message)
	if message == "" || utf8.RuneCountInString(message) > maxErrorReportMessageRunes {
		return "", fmt.Errorf("Сообщение должно содержать от 1 до %d символов", maxErrorReportMessageRunes)
	}
	return message, nil
}

func normalizeErrorReportTitle(title string) (string, error) {
	title = strings.TrimSpace(title)
	if title == "" || utf8.RuneCountInString(title) > maxErrorReportTitleRunes {
		return "", fmt.Errorf("Заголовок должен содержать от 1 до %d символов", maxErrorReportTitleRunes)
	}
	return title, nil
}

func defaultErrorReportTitle(description string) string {
	description = strings.TrimSpace(description)
	if line, _, found := strings.Cut(description, "\n"); found {
		description = strings.TrimSpace(line)
	}
	runes := []rune(description)
	if len(runes) > maxErrorReportTitleRunes {
		description = strings.TrimSpace(string(runes[:maxErrorReportTitleRunes-1])) + "…"
	}
	return description
}

func (s *Server) handleAdminErrorReportScreenshot(w http.ResponseWriter, r *http.Request) {
	s.handleErrorReportImage(w, r, false, false)
}

func (s *Server) handleAdminErrorReportViewportScreenshot(w http.ResponseWriter, r *http.Request) {
	s.handleErrorReportImage(w, r, true, false)
}

func (s *Server) handleReviewerErrorReportScreenshot(w http.ResponseWriter, r *http.Request) {
	s.handleErrorReportImage(w, r, false, true)
}

func (s *Server) handleReviewerErrorReportViewportScreenshot(w http.ResponseWriter, r *http.Request) {
	s.handleErrorReportImage(w, r, true, true)
}

func (s *Server) handleErrorReportImage(w http.ResponseWriter, r *http.Request, viewport, reviewerAccess bool) {
	if reviewerAccess {
		if _, ok := s.requireAnyRole(w, r, RoleErrorReportReviewer, RoleAdmin); !ok {
			return
		}
	} else if _, ok := s.requireRole(w, r, RoleAdmin); !ok {
		return
	}
	id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil || id <= 0 {
		badRequest(w, "bad id")
		return
	}
	var screenshot []byte
	var contentType string
	if reviewerAccess && viewport {
		screenshot, contentType, err = s.store.GetReviewerErrorReportViewportScreenshot(r.Context(), id)
	} else if reviewerAccess {
		screenshot, contentType, err = s.store.GetReviewerErrorReportScreenshot(r.Context(), id)
	} else if viewport {
		screenshot, contentType, err = s.store.GetErrorReportViewportScreenshot(r.Context(), id)
	} else {
		screenshot, contentType, err = s.store.GetErrorReportScreenshot(r.Context(), id)
	}
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			notFound(w, "Скриншот не найден")
			return
		}
		serverError(w, err)
		return
	}
	w.Header().Set("Content-Type", contentType)
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.Header().Set("Cache-Control", "private, no-store")
	w.Header().Set("Content-Length", strconv.Itoa(len(screenshot)))
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(screenshot)
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
