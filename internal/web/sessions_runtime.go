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
	_, _, snapshot, ok := s.encounterSnapshot(w, r)
	if !ok {
		return
	}
	w.Header().Set("Cache-Control", "no-store")
	writeJSON(w, http.StatusOK, snapshot)
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
	snapshot, err := s.store.GetMusicStateSnapshot(r.Context(), session.ID)
	if err != nil {
		serverError(w, err)
		return
	}
	if snapshot == nil {
		writeJSON(w, http.StatusOK, map[string]any{})
		return
	}
	var data map[string]any
	if json.Unmarshal([]byte(snapshot.Data), &data) != nil || data == nil {
		serverError(w, errors.New("invalid session music state"))
		return
	}
	data["syncedAt"] = snapshot.ChangedAt.UnixMilli()
	data["serverTime"] = time.Now().UnixMilli()
	writeJSON(w, http.StatusOK, data)
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
	var state map[string]json.RawMessage
	if json.Unmarshal(raw, &state) != nil || state == nil {
		badRequest(w, "Некорректный запрос")
		return
	}
	if err := s.store.SaveMusicStateData(r.Context(), session.ID, string(raw)); err != nil {
		serverError(w, err)
		return
	}
	s.displayEvents.publish(session.ID)
	s.publishSessionJournal(session.ID)
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
	fileKey, ownerUserID, isSystem, err := s.store.GetMusicTrackFileKey(r.Context(), trackID)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			notFound(w, "")
			return
		}
		serverError(w, err)
		return
	}
	if !isSystem && ownerUserID != session.OwnerUserID {
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
