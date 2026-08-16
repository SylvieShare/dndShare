package web

import (
	"encoding/json"
	"errors"
	"math"
	"net/http"
	"time"

	"dndshare/internal/store"
)

type storedSessionMusicPlayback struct {
	Playing         bool     `json:"playing"`
	TrackID         *int64   `json:"trackId"`
	PositionSec     *float64 `json:"positionSec"`
	Volume          *float64 `json:"volume"`
	CrossfadeDurSec *float64 `json:"crossfadeDurSec"`
	NextTrackID     *int64   `json:"nextTrackId"`
	LoopMode        string   `json:"loopMode"`
}

type publicDisplayMusicResponse struct {
	Enabled         bool    `json:"enabled"`
	Playing         bool    `json:"playing"`
	TrackID         *int64  `json:"trackId,omitempty"`
	TrackURL        string  `json:"trackUrl,omitempty"`
	NextTrackID     *int64  `json:"nextTrackId,omitempty"`
	NextTrackURL    string  `json:"nextTrackUrl,omitempty"`
	PositionSec     float64 `json:"positionSec"`
	Volume          float64 `json:"volume"`
	CrossfadeDurSec float64 `json:"crossfadeDurSec"`
	LoopMode        string  `json:"loopMode"`
	SyncedAt        int64   `json:"syncedAt"`
	ServerTime      int64   `json:"serverTime"`
}

func (s *Server) handleGetPublicDisplayMusic(w http.ResponseWriter, r *http.Request) {
	uuid := r.PathValue("uuid")
	if !isUUID(uuid) {
		notFound(w, "")
		return
	}
	session, err := s.store.GetGameSessionByUUID(r.Context(), uuid)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			notFound(w, "")
		} else {
			serverError(w, err)
		}
		return
	}
	presentation, err := s.store.GetSessionPresentation(r.Context(), session.ID)
	if err != nil {
		serverError(w, err)
		return
	}
	now := time.Now()
	response := publicDisplayMusicResponse{
		Enabled: presentation.BroadcastMusic, Volume: 0.8, CrossfadeDurSec: 2.5,
		LoopMode: "album", ServerTime: now.UnixMilli(),
	}
	if !presentation.BroadcastMusic {
		w.Header().Set("Cache-Control", "no-store")
		writeJSON(w, http.StatusOK, response)
		return
	}

	snapshot, err := s.store.GetMusicStateSnapshot(r.Context(), session.ID)
	if err != nil {
		serverError(w, err)
		return
	}
	if snapshot == nil {
		w.Header().Set("Cache-Control", "no-store")
		writeJSON(w, http.StatusOK, response)
		return
	}
	var playback storedSessionMusicPlayback
	if json.Unmarshal([]byte(snapshot.Data), &playback) != nil {
		serverError(w, errors.New("invalid session music state"))
		return
	}
	response.Playing = playback.Playing
	response.TrackID = positiveMusicTrackID(playback.TrackID)
	if playback.PositionSec != nil {
		response.PositionSec = clampFloat(*playback.PositionSec, 0, math.MaxFloat64)
	}
	if playback.Volume != nil {
		response.Volume = clampFloat(*playback.Volume, 0, 1)
	}
	if playback.CrossfadeDurSec != nil {
		response.CrossfadeDurSec = clampFloat(*playback.CrossfadeDurSec, 0, 15)
	}
	response.LoopMode = "album"
	if playback.LoopMode == "track" {
		response.LoopMode = "track"
	}
	response.SyncedAt = snapshot.ChangedAt.UnixMilli()
	if response.TrackID != nil {
		response.TrackURL, err = s.publicDisplayTrackURL(r, session.OwnerUserID, *response.TrackID)
		if err != nil {
			serverError(w, err)
			return
		}
	}
	if nextID := positiveMusicTrackID(playback.NextTrackID); nextID != nil && (response.TrackID == nil || *nextID != *response.TrackID) {
		response.NextTrackID = nextID
		response.NextTrackURL, err = s.publicDisplayTrackURL(r, session.OwnerUserID, *nextID)
		if err != nil {
			serverError(w, err)
			return
		}
	}
	w.Header().Set("Cache-Control", "no-store")
	writeJSON(w, http.StatusOK, response)
}

func (s *Server) publicDisplayTrackURL(r *http.Request, ownerUserID, trackID int64) (string, error) {
	fileKey, trackOwnerID, isSystem, err := s.store.GetMusicTrackFileKey(r.Context(), trackID)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			return "", nil
		}
		return "", err
	}
	if !isSystem && trackOwnerID != ownerUserID {
		return "", nil
	}
	return s.s3.PresignGet(r.Context(), fileKey, time.Hour)
}

func positiveMusicTrackID(value *int64) *int64 {
	if value == nil || *value <= 0 {
		return nil
	}
	return value
}

func clampFloat(value, minValue, maxValue float64) float64 {
	if value < minValue {
		return minValue
	}
	if value > maxValue {
		return maxValue
	}
	return value
}
