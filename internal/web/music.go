package web

import (
	"errors"
	"fmt"
	"log"
	"net/http"
	"strconv"
	"strings"
	"time"

	"dndshare/internal/store"
)

func init() { registerRoutes((*Server).routesMusic) }

const maxTrackBytes int64 = 50 * 1024 * 1024

func (s *Server) routesMusic(mux *http.ServeMux) {
	// tracks
	mux.HandleFunc("GET /api/music/tracks", s.handleListTracks)
	mux.HandleFunc("POST /api/music/tracks", s.handleUploadTrack)
	mux.HandleFunc("GET /api/music/tracks/search", s.handleSearchTracks)
	mux.HandleFunc("PATCH /api/music/tracks/{id}", s.handleRenameTrack)
	mux.HandleFunc("DELETE /api/music/tracks/{id}", s.handleDeleteTrack)
	mux.HandleFunc("GET /api/music/tracks/{id}/url", s.handleGetTrackURL)
	mux.HandleFunc("POST /api/music/tracks/{id}/tags", s.handleAddTrackTag)
	mux.HandleFunc("POST /api/music/tracks/{id}/tags/{tagId}", s.handleAttachTagToTrack)
	mux.HandleFunc("DELETE /api/music/tracks/{id}/tags/{tagId}", s.handleRemoveTrackTag)

	// albums
	mux.HandleFunc("GET /api/music/albums", s.handleListAlbums)
	mux.HandleFunc("POST /api/music/albums", s.handleCreateAlbum)
	mux.HandleFunc("PATCH /api/music/albums/{id}", s.handleUpdateAlbum)
	mux.HandleFunc("DELETE /api/music/albums/{id}", s.handleDeleteAlbum)
	mux.HandleFunc("GET /api/music/albums/{id}/tracks", s.handleListAlbumTracks)
	mux.HandleFunc("POST /api/music/albums/{id}/tracks", s.handleAddTrackToAlbum)
	mux.HandleFunc("PUT /api/music/albums/{id}/order", s.handleReorderAlbumTracks)
	mux.HandleFunc("DELETE /api/music/albums/{id}/tracks/{trackId}", s.handleRemoveTrackFromAlbum)

	// tags
	mux.HandleFunc("GET /api/music/tags", s.handleListTags)
	mux.HandleFunc("POST /api/music/tags", s.handleCreateTag)
	mux.HandleFunc("PATCH /api/music/tags/{id}", s.handleRenameTag)
	mux.HandleFunc("DELETE /api/music/tags/{id}", s.handleDeleteTag)
}

// requireOwnedTrack достаёт трек и проверяет владельца (404 если нет, 401 если чужой).
func (s *Server) requireOwnedTrack(w http.ResponseWriter, r *http.Request, id, userID int64) (store.MusicTrack, bool) {
	t, err := s.store.GetMusicTrackByID(r.Context(), id)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			notFound(w, "")
			return store.MusicTrack{}, false
		}
		serverError(w, err)
		return store.MusicTrack{}, false
	}
	if t.OwnerUserID != userID {
		unauthorized(w)
		return store.MusicTrack{}, false
	}
	return t, true
}

// requireOwnedAlbum достаёт альбом и проверяет владельца (404 если нет, 401 если чужой).
func (s *Server) requireOwnedAlbum(w http.ResponseWriter, r *http.Request, id, userID int64) (store.MusicAlbum, bool) {
	a, err := s.store.GetMusicAlbumByID(r.Context(), id)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			notFound(w, "")
			return store.MusicAlbum{}, false
		}
		serverError(w, err)
		return store.MusicAlbum{}, false
	}
	if a.OwnerUserID != userID {
		unauthorized(w)
		return store.MusicAlbum{}, false
	}
	return a, true
}

func musicID(r *http.Request, name string) (int64, bool) {
	id, err := strconv.ParseInt(r.PathValue(name), 10, 64)
	if err != nil {
		return 0, false
	}
	return id, true
}

// ---- tracks ----

func (s *Server) handleListTracks(w http.ResponseWriter, r *http.Request) {
	uid, ok := mustUser(w, r)
	if !ok {
		return
	}
	tracks, err := s.store.GetMusicTracksByOwner(r.Context(), uid)
	if err != nil {
		serverError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"tracks": nonNil(tracks)})
}

func (s *Server) handleUploadTrack(w http.ResponseWriter, r *http.Request) {
	uid, ok := mustUser(w, r)
	if !ok {
		return
	}
	// Ограничиваем всё тело запроса до разбора multipart, иначе 50-МБ проверка ниже
	// сработает только после того, как гигабайтное тело уже прочитано на диск.
	r.Body = http.MaxBytesReader(w, r.Body, maxTrackBytes+1<<20)
	if err := r.ParseMultipartForm(maxTrackBytes + 1<<20); err != nil {
		badRequest(w, "empty file")
		return
	}
	file, header, err := r.FormFile("file")
	if err != nil {
		badRequest(w, "empty file")
		return
	}
	defer file.Close()
	if header.Size == 0 {
		badRequest(w, "empty file")
		return
	}
	if header.Size > maxTrackBytes {
		badRequest(w, "file too large")
		return
	}
	mime := header.Header.Get("Content-Type")
	if mime == "" {
		mime = "application/octet-stream"
	}
	if !strings.HasPrefix(mime, "audio/") {
		badRequest(w, "not audio")
		return
	}

	stored, err := s.s3.UploadAudio(r.Context(), file, header.Size, header.Filename, mime, fmt.Sprintf("music/%d", uid))
	if err != nil {
		serverError(w, err)
		return
	}

	originalName := header.Filename
	if i := strings.LastIndex(originalName, "."); i >= 0 {
		originalName = originalName[:i]
	}
	if originalName == "" {
		originalName = "track"
	}
	displayName := originalName
	if n := strings.TrimSpace(r.FormValue("name")); n != "" {
		displayName = n
	}
	fileName := header.Filename
	if fileName == "" {
		fileName = displayName
	}

	var durationSec *int
	if d, err := strconv.Atoi(strings.TrimSpace(r.FormValue("durationSec"))); err == nil {
		durationSec = &d
	}

	track, err := s.store.CreateMusicTrack(r.Context(), uid, displayName, stored.Key, fileName, durationSec, header.Size, mime)
	if err != nil {
		serverError(w, err)
		return
	}

	if aid, err := strconv.ParseInt(strings.TrimSpace(r.FormValue("albumId")), 10, 64); err == nil {
		album, err := s.store.GetMusicAlbumByID(r.Context(), aid)
		if err == nil && album.OwnerUserID == uid {
			if err := s.store.AddTrackToAlbum(r.Context(), aid, track.ID); err != nil {
				serverError(w, err)
				return
			}
		}
	}

	full, err := s.store.GetMusicTrackByID(r.Context(), track.ID)
	if err != nil {
		serverError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, full)
}

func (s *Server) handleRenameTrack(w http.ResponseWriter, r *http.Request) {
	uid, ok := mustUser(w, r)
	if !ok {
		return
	}
	id, ok := musicID(r, "id")
	if !ok {
		badRequest(w, "bad id")
		return
	}
	if _, ok := s.requireOwnedTrack(w, r, id, uid); !ok {
		return
	}
	var req struct {
		Name string `json:"name"`
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
	if err := s.store.RenameMusicTrack(r.Context(), id, name); err != nil {
		serverError(w, err)
		return
	}
	track, err := s.store.GetMusicTrackByID(r.Context(), id)
	if err != nil {
		serverError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, track)
}

func (s *Server) handleDeleteTrack(w http.ResponseWriter, r *http.Request) {
	uid, ok := mustUser(w, r)
	if !ok {
		return
	}
	id, ok := musicID(r, "id")
	if !ok {
		badRequest(w, "bad id")
		return
	}
	t, ok := s.requireOwnedTrack(w, r, id, uid)
	if !ok {
		return
	}
	if err := s.store.DeleteMusicTrack(r.Context(), id); err != nil {
		serverError(w, err)
		return
	}
	if err := s.s3.DeleteObject(r.Context(), t.FileKey); err != nil {
		log.Printf("delete track object %q: %v", t.FileKey, err)
	}
	writeJSON(w, http.StatusNoContent, nil)
}

type trackURLResponse struct {
	URL    string `json:"url"`
	TTLSec int64  `json:"ttlSec"`
}

func (s *Server) handleGetTrackURL(w http.ResponseWriter, r *http.Request) {
	uid, ok := mustUser(w, r)
	if !ok {
		return
	}
	id, ok := musicID(r, "id")
	if !ok {
		badRequest(w, "bad id")
		return
	}
	t, ok := s.requireOwnedTrack(w, r, id, uid)
	if !ok {
		return
	}
	url, err := s.s3.PresignGet(r.Context(), t.FileKey, 3600*time.Second)
	if err != nil {
		serverError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, trackURLResponse{URL: url, TTLSec: 3600})
}

func (s *Server) handleSearchTracks(w http.ResponseWriter, r *http.Request) {
	uid, ok := mustUser(w, r)
	if !ok {
		return
	}
	all, err := s.store.GetMusicTracksByOwner(r.Context(), uid)
	if err != nil {
		serverError(w, err)
		return
	}
	q := strings.TrimSpace(r.URL.Query().Get("q"))
	var tagIDs []int64
	for _, raw := range r.URL.Query()["tagIds"] {
		for _, part := range strings.Split(raw, ",") {
			if tid, err := strconv.ParseInt(strings.TrimSpace(part), 10, 64); err == nil {
				tagIDs = append(tagIDs, tid)
			}
		}
	}
	filtered := make([]store.MusicTrack, 0, len(all))
	for _, track := range all {
		matchesQuery := q == "" || strings.Contains(strings.ToLower(track.Name), strings.ToLower(q))
		matchesTags := true
		for _, tid := range tagIDs {
			has := false
			for _, tag := range track.Tags {
				if tag.ID == tid {
					has = true
					break
				}
			}
			if !has {
				matchesTags = false
				break
			}
		}
		if matchesQuery && matchesTags {
			filtered = append(filtered, track)
		}
	}
	writeJSON(w, http.StatusOK, map[string]any{"tracks": filtered})
}

// ---- albums ----

func (s *Server) handleListAlbums(w http.ResponseWriter, r *http.Request) {
	uid, ok := mustUser(w, r)
	if !ok {
		return
	}
	albums, err := s.store.GetMusicAlbumsByOwner(r.Context(), uid)
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
	if _, ok := s.requireOwnedAlbum(w, r, id, uid); !ok {
		return
	}
	tracks, err := s.store.GetTracksInAlbum(r.Context(), id)
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
	if _, ok := s.requireOwnedTrack(w, r, req.TrackID, uid); !ok {
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

func (s *Server) handleListTags(w http.ResponseWriter, r *http.Request) {
	uid, ok := mustUser(w, r)
	if !ok {
		return
	}
	tags, err := s.store.GetMusicTagsByOwner(r.Context(), uid)
	if err != nil {
		serverError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"tags": nonNil(tags)})
}

func (s *Server) handleCreateTag(w http.ResponseWriter, r *http.Request) {
	uid, ok := mustUser(w, r)
	if !ok {
		return
	}
	var req struct {
		Name string `json:"name"`
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
	tag, err := s.store.FindMusicTagByName(r.Context(), uid, name)
	if err != nil {
		if !errors.Is(err, store.ErrNotFound) {
			serverError(w, err)
			return
		}
		tag, err = s.store.CreateMusicTag(r.Context(), uid, name)
		if err != nil {
			serverError(w, err)
			return
		}
	}
	writeJSON(w, http.StatusOK, tag)
}

func (s *Server) handleRenameTag(w http.ResponseWriter, r *http.Request) {
	uid, ok := mustUser(w, r)
	if !ok {
		return
	}
	id, ok := musicID(r, "id")
	if !ok {
		badRequest(w, "bad id")
		return
	}
	tag, err := s.store.GetMusicTagByID(r.Context(), id)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			notFound(w, "")
			return
		}
		serverError(w, err)
		return
	}
	if tag.OwnerUserID != uid {
		unauthorized(w)
		return
	}
	var req struct {
		Name string `json:"name"`
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
	if err := s.store.RenameMusicTag(r.Context(), id, name); err != nil {
		serverError(w, err)
		return
	}
	updated, err := s.store.GetMusicTagByID(r.Context(), id)
	if err != nil {
		serverError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, updated)
}

func (s *Server) handleDeleteTag(w http.ResponseWriter, r *http.Request) {
	uid, ok := mustUser(w, r)
	if !ok {
		return
	}
	id, ok := musicID(r, "id")
	if !ok {
		badRequest(w, "bad id")
		return
	}
	tag, err := s.store.GetMusicTagByID(r.Context(), id)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			notFound(w, "")
			return
		}
		serverError(w, err)
		return
	}
	if tag.OwnerUserID != uid {
		unauthorized(w)
		return
	}
	if err := s.store.DeleteMusicTag(r.Context(), id); err != nil {
		serverError(w, err)
		return
	}
	writeJSON(w, http.StatusNoContent, nil)
}

func (s *Server) handleAttachTagToTrack(w http.ResponseWriter, r *http.Request) {
	uid, ok := mustUser(w, r)
	if !ok {
		return
	}
	id, ok := musicID(r, "id")
	if !ok {
		badRequest(w, "bad id")
		return
	}
	tagID, ok := musicID(r, "tagId")
	if !ok {
		badRequest(w, "bad id")
		return
	}
	if _, ok := s.requireOwnedTrack(w, r, id, uid); !ok {
		return
	}
	tag, err := s.store.GetMusicTagByID(r.Context(), tagID)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			notFound(w, "")
			return
		}
		serverError(w, err)
		return
	}
	if tag.OwnerUserID != uid {
		unauthorized(w)
		return
	}
	if err := s.store.AddTagToTrack(r.Context(), id, tagID); err != nil {
		serverError(w, err)
		return
	}
	track, err := s.store.GetMusicTrackByID(r.Context(), id)
	if err != nil {
		serverError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, track)
}

func (s *Server) handleAddTrackTag(w http.ResponseWriter, r *http.Request) {
	uid, ok := mustUser(w, r)
	if !ok {
		return
	}
	id, ok := musicID(r, "id")
	if !ok {
		badRequest(w, "bad id")
		return
	}
	if _, ok := s.requireOwnedTrack(w, r, id, uid); !ok {
		return
	}
	var req struct {
		Name string `json:"name"`
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
	tag, err := s.store.FindMusicTagByName(r.Context(), uid, name)
	if err != nil {
		if !errors.Is(err, store.ErrNotFound) {
			serverError(w, err)
			return
		}
		tag, err = s.store.CreateMusicTag(r.Context(), uid, name)
		if err != nil {
			serverError(w, err)
			return
		}
	}
	if err := s.store.AddTagToTrack(r.Context(), id, tag.ID); err != nil {
		serverError(w, err)
		return
	}
	track, err := s.store.GetMusicTrackByID(r.Context(), id)
	if err != nil {
		serverError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, track)
}

func (s *Server) handleRemoveTrackTag(w http.ResponseWriter, r *http.Request) {
	uid, ok := mustUser(w, r)
	if !ok {
		return
	}
	id, ok := musicID(r, "id")
	if !ok {
		badRequest(w, "bad id")
		return
	}
	tagID, ok := musicID(r, "tagId")
	if !ok {
		badRequest(w, "bad id")
		return
	}
	if _, ok := s.requireOwnedTrack(w, r, id, uid); !ok {
		return
	}
	if err := s.store.RemoveTagFromTrack(r.Context(), id, tagID); err != nil {
		serverError(w, err)
		return
	}
	writeJSON(w, http.StatusNoContent, nil)
}
