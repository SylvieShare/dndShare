package web

import (
	"net/http"
	"strings"
)

func (s *Server) handleListAlbums(w http.ResponseWriter, r *http.Request) {
	uid, ok := mustUser(w, r)
	if !ok {
		return
	}
	albums, err := s.store.GetMusicAlbumsForUser(r.Context(), uid)
	if err != nil {
		serverError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"albums": nonNil(albums)})
}

func (s *Server) handleCreateAlbum(w http.ResponseWriter, r *http.Request) {
	uid, ok := mustUser(w, r)
	if !ok {
		return
	}
	var req struct {
		Name  string  `json:"name"`
		Color *string `json:"color"`
	}
	if err := decodeJSON(r, &req); err != nil {
		badRequest(w, "bad body")
		return
	}
	name := strings.TrimSpace(req.Name)
	if name == "" {
		badRequest(w, "")
		return
	}
	album, err := s.store.CreateMusicAlbum(r.Context(), uid, name, req.Color)
	if err != nil {
		serverError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, album)
}

func (s *Server) handleUpdateAlbum(w http.ResponseWriter, r *http.Request) {
	uid, ok := mustUser(w, r)
	if !ok {
		return
	}
	id, ok := musicID(r, "id")
	if !ok {
		badRequest(w, "bad id")
		return
	}
	if _, ok := s.requireOwnedAlbum(w, r, id, uid); !ok {
		return
	}
	var req struct {
		Name         *string `json:"name"`
		Color        *string `json:"color"`
		ColorChanged bool    `json:"colorChanged"`
	}
	if err := decodeJSON(r, &req); err != nil {
		badRequest(w, "bad body")
		return
	}
	var name *string
	if req.Name != nil {
		trimmed := strings.TrimSpace(*req.Name)
		name = &trimmed
	}
	if err := s.store.UpdateMusicAlbum(r.Context(), id, name, req.Color, req.ColorChanged); err != nil {
		serverError(w, err)
		return
	}
	album, err := s.store.GetMusicAlbumByID(r.Context(), id)
	if err != nil {
		serverError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, album)
}

func (s *Server) handleDeleteAlbum(w http.ResponseWriter, r *http.Request) {
	uid, ok := mustUser(w, r)
	if !ok {
		return
	}
	id, ok := musicID(r, "id")
	if !ok {
		badRequest(w, "bad id")
		return
	}
	if _, ok := s.requireOwnedAlbum(w, r, id, uid); !ok {
		return
	}
	if err := s.store.DeleteMusicAlbum(r.Context(), id); err != nil {
		serverError(w, err)
		return
	}
	writeJSON(w, http.StatusNoContent, nil)
}

func (s *Server) handleListAlbumTracks(w http.ResponseWriter, r *http.Request) {
	uid, ok := mustUser(w, r)
	if !ok {
		return
	}
	id, ok := musicID(r, "id")
	if !ok {
		badRequest(w, "bad id")
		return
	}
	if _, ok := s.requireAccessibleAlbum(w, r, id, uid); !ok {
		return
	}
	tracks, err := s.store.GetTracksInAlbum(r.Context(), id, uid)
	if err != nil {
		serverError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"tracks": nonNil(tracks)})
}

func (s *Server) handleAddTrackToAlbum(w http.ResponseWriter, r *http.Request) {
	uid, ok := mustUser(w, r)
	if !ok {
		return
	}
	id, ok := musicID(r, "id")
	if !ok {
		badRequest(w, "bad id")
		return
	}
	if _, ok := s.requireOwnedAlbum(w, r, id, uid); !ok {
		return
	}
	var req struct {
		TrackID int64 `json:"trackId"`
	}
	if err := decodeJSON(r, &req); err != nil {
		badRequest(w, "bad body")
		return
	}
	if _, ok := s.requireAccessibleTrack(w, r, req.TrackID, uid); !ok {
		return
	}
	if err := s.store.AddTrackToAlbum(r.Context(), id, req.TrackID); err != nil {
		serverError(w, err)
		return
	}
	writeJSON(w, http.StatusNoContent, nil)
}

func (s *Server) handleReorderAlbumTracks(w http.ResponseWriter, r *http.Request) {
	uid, ok := mustUser(w, r)
	if !ok {
		return
	}
	id, ok := musicID(r, "id")
	if !ok {
		badRequest(w, "bad id")
		return
	}
	if _, ok := s.requireOwnedAlbum(w, r, id, uid); !ok {
		return
	}
	var req struct {
		TrackIDs []int64 `json:"trackIds"`
	}
	if err := decodeJSON(r, &req); err != nil {
		badRequest(w, "bad body")
		return
	}
	if err := s.store.SetAlbumTrackOrder(r.Context(), id, req.TrackIDs); err != nil {
		serverError(w, err)
		return
	}
	writeJSON(w, http.StatusNoContent, nil)
}

func (s *Server) handleRemoveTrackFromAlbum(w http.ResponseWriter, r *http.Request) {
	uid, ok := mustUser(w, r)
	if !ok {
		return
	}
	id, ok := musicID(r, "id")
	if !ok {
		badRequest(w, "bad id")
		return
	}
	trackID, ok := musicID(r, "trackId")
	if !ok {
		badRequest(w, "bad id")
		return
	}
	if _, ok := s.requireOwnedAlbum(w, r, id, uid); !ok {
		return
	}
	if err := s.store.RemoveTrackFromAlbum(r.Context(), id, trackID); err != nil {
		serverError(w, err)
		return
	}
	writeJSON(w, http.StatusNoContent, nil)
}

// ---- tags ----
