package web

import (
	"dndshare/internal/store"
	"errors"
	"net/http"
	"strconv"
)

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
