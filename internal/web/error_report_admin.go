package web

import (
	"dndshare/internal/store"
	"errors"
	"net/http"
	"strconv"
)

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
