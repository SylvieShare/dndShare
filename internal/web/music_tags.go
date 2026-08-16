package web

import (
	"errors"
	"net/http"
	"strings"

	"dndshare/internal/store"
)

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
	if _, ok := s.requireAccessibleTrack(w, r, id, uid); !ok {
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
	track, err := s.store.GetMusicTrackByIDForUser(r.Context(), id, uid)
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
	if _, ok := s.requireAccessibleTrack(w, r, id, uid); !ok {
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
	track, err := s.store.GetMusicTrackByIDForUser(r.Context(), id, uid)
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
	if _, ok := s.requireAccessibleTrack(w, r, id, uid); !ok {
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
	if err := s.store.RemoveTagFromTrack(r.Context(), id, tagID); err != nil {
		serverError(w, err)
		return
	}
	writeJSON(w, http.StatusNoContent, nil)
}
