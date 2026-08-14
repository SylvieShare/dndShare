package web

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strconv"
	"time"

	"dndshare/internal/store"
)

func (s *Server) handleGetEncounter(w http.ResponseWriter, r *http.Request) {
	userID, ok := mustUser(w, r)
	if !ok {
		return
	}
	session, err := s.lookupSession(w, r)
	if err != nil {
		return
	}
	if session.OwnerUserID != userID {
		forbidden(w)
		return
	}
	data, err := s.store.GetEncounterData(r.Context(), session.ID)
	if err != nil {
		serverError(w, err)
		return
	}
	writeRawJSON(w, data)
}

func (s *Server) handleSaveEncounter(w http.ResponseWriter, r *http.Request) {
	userID, ok := mustUser(w, r)
	if !ok {
		return
	}
	session, err := s.lookupSession(w, r)
	if err != nil {
		return
	}
	if session.OwnerUserID != userID {
		forbidden(w)
		return
	}
	raw, err := io.ReadAll(http.MaxBytesReader(w, r.Body, maxJSONBody))
	if err != nil {
		badRequest(w, "Некорректный запрос")
		return
	}
	if !json.Valid(raw) {
		badRequest(w, "Некорректный запрос")
		return
	}
	var meta struct {
		Active bool `json:"active"`
		Round  int  `json:"round"`
	}
	_ = json.Unmarshal(raw, &meta)
	wasActive := false
	if previous, previousErr := s.store.GetEncounterData(r.Context(), session.ID); previousErr == nil && previous != nil {
		var previousMeta struct {
			Active bool `json:"active"`
		}
		_ = json.Unmarshal([]byte(*previous), &previousMeta)
		wasActive = previousMeta.Active
	}
	status := "pending"
	if meta.Active {
		status = "active"
	}
	if err := s.store.SaveEncounterData(r.Context(), session.ID, status, meta.Round, string(raw)); err != nil {
		serverError(w, err)
		return
	}
	if meta.Active != wasActive {
		eventType := "encounter_finished"
		title := "Бой завершён"
		if meta.Active {
			eventType = "encounter_started"
			title = "Бой начался"
		}
		s.appendSessionEvent(r.Context(), session.ID, userID, eventType, title, map[string]any{"round": meta.Round})
	}
	writeJSON(w, http.StatusNoContent, nil)
}

func (s *Server) handleGetMusicState(w http.ResponseWriter, r *http.Request) {
	userID, ok := mustUser(w, r)
	if !ok {
		return
	}
	session, err := s.lookupSession(w, r)
	if err != nil {
		return
	}
	if session.OwnerUserID != userID {
		forbidden(w)
		return
	}
	data, err := s.store.GetMusicStateData(r.Context(), session.ID)
	if err != nil {
		serverError(w, err)
		return
	}
	writeRawJSON(w, data)
}

func (s *Server) handleSaveMusicState(w http.ResponseWriter, r *http.Request) {
	userID, ok := mustUser(w, r)
	if !ok {
		return
	}
	session, err := s.lookupSession(w, r)
	if err != nil {
		return
	}
	if session.OwnerUserID != userID {
		forbidden(w)
		return
	}
	raw, err := io.ReadAll(http.MaxBytesReader(w, r.Body, maxJSONBody))
	if err != nil {
		badRequest(w, "Некорректный запрос")
		return
	}
	if !json.Valid(raw) {
		badRequest(w, "Некорректный запрос")
		return
	}
	if err := s.store.SaveMusicStateData(r.Context(), session.ID, string(raw)); err != nil {
		serverError(w, err)
		return
	}
	writeJSON(w, http.StatusNoContent, nil)
}

type musicTrackURLResponse struct {
	URL    string `json:"url"`
	TTLSec int64  `json:"ttlSec"`
}

func (s *Server) handleGetSessionTrackURL(w http.ResponseWriter, r *http.Request) {
	userID, ok := mustUser(w, r)
	if !ok {
		return
	}
	session, err := s.lookupSession(w, r)
	if err != nil {
		return
	}
	if session.OwnerUserID != userID {
		forbidden(w)
		return
	}
	trackID, err := strconv.ParseInt(r.PathValue("trackId"), 10, 64)
	if err != nil {
		badRequest(w, "Некорректный запрос")
		return
	}
	fileKey, ownerUserID, err := s.store.GetMusicTrackFileKey(r.Context(), trackID)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			notFound(w, "")
			return
		}
		serverError(w, err)
		return
	}
	if ownerUserID != session.OwnerUserID {
		forbidden(w)
		return
	}
	url, err := s.s3.PresignGet(r.Context(), fileKey, 3600*time.Second)
	if err != nil {
		serverError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, musicTrackURLResponse{URL: url, TTLSec: 3600})
}
