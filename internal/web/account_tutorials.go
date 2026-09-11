package web

import (
	"net/http"
	"regexp"
	"strings"

	"dndshare/internal/store"
)

func init() { registerRoutes((*Server).routesAccountTutorials) }
func (s *Server) routesAccountTutorials(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/account/tutorials", s.handleListAccountTutorials)
	mux.HandleFunc("PUT /api/account/tutorials", s.handleSaveAccountTutorial)
	mux.HandleFunc("POST /api/account/tutorials/reset", s.handleResetAccountTutorial)
}

var tutorialSourceKey = regexp.MustCompile(`^(source:[1-9][0-9]{0,17}|edition:[1-9][0-9]{0,17}|unassigned)$`)

func validateTutorial(entry store.UserTutorial, reset bool) bool {
	if entry.FlowID != "character" && entry.FlowID != "session-player" && entry.FlowID != "session-dm" {
		return false
	}
	if entry.Device != "desktop" && entry.Device != "mobile" {
		return false
	}
	if !tutorialSourceKey.MatchString(entry.SourceKey) {
		return false
	}
	if entry.FlowID == "character" && !strings.HasPrefix(entry.SourceKey, "edition:") {
		return false
	}
	if entry.FlowID != "character" && strings.HasPrefix(entry.SourceKey, "edition:") {
		return false
	}
	if reset {
		return true
	}
	return entry.Revision > 0 && entry.Revision <= 10000 && (entry.Status == "completed" || entry.Status == "dismissed")
}
func (s *Server) handleListAccountTutorials(w http.ResponseWriter, r *http.Request) {
	userID, ok := mustUser(w, r)
	if !ok {
		return
	}
	entries, err := s.store.ListUserTutorials(r.Context(), userID)
	if err != nil {
		serverError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"tutorials": entries})
}
func (s *Server) handleSaveAccountTutorial(w http.ResponseWriter, r *http.Request) {
	s.writeAccountTutorial(w, r, false)
}
func (s *Server) handleResetAccountTutorial(w http.ResponseWriter, r *http.Request) {
	s.writeAccountTutorial(w, r, true)
}
func (s *Server) writeAccountTutorial(w http.ResponseWriter, r *http.Request, reset bool) {
	userID, ok := mustUser(w, r)
	if !ok {
		return
	}
	var entry store.UserTutorial
	if decodeJSON(r, &entry) != nil {
		return
	}
	if !validateTutorial(entry, reset) {
		badRequest(w, "Некорректный сценарий обучения")
		return
	}
	var err error
	if !reset {
		exists, sourceErr := s.store.TutorialSourceExists(r.Context(), entry.SourceKey)
		if sourceErr != nil {
			serverError(w, sourceErr)
			return
		}
		if !exists {
			badRequest(w, "Источник обучения не существует")
			return
		}
	}
	if reset {
		err = s.store.ResetUserTutorial(r.Context(), userID, entry)
	} else {
		err = s.store.SaveUserTutorial(r.Context(), userID, entry)
	}
	if err != nil {
		serverError(w, err)
		return
	}
	writeJSON(w, http.StatusNoContent, nil)
}
