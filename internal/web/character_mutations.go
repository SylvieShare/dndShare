package web

import (
	"dndshare/internal/documentpatch"
	"dndshare/internal/documentsync"
	"dndshare/internal/store"
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
)

func init() { registerRoutes((*Server).routesCharacterMutations) }
func (s *Server) routesCharacterMutations(mux *http.ServeMux) {
	mux.HandleFunc("PATCH /api/char/{uuid}/data", s.handleCharacterMutation)
	mux.HandleFunc("GET /api/char/{uuid}/changes", s.handleCharacterChanges)
	mux.HandleFunc("GET /api/char/{uuid}/history", s.handleCharacterHistory)
}
func (s *Server) characterReceipt(w http.ResponseWriter, r *http.Request, char store.CharacterItem, user int64, mutation documentsync.Mutation) bool {
	change, err := s.store.CharacterMutation(r.Context(), char.ID, mutation.MutationID)
	if errors.Is(err, store.ErrNotFound) {
		return false
	}
	if err != nil {
		serverError(w, err)
		return true
	}
	if change.RequestHash != mutation.Fingerprint() || change.AuthorUserID == nil || *change.AuthorUserID != user {
		badRequest(w, "Идентификатор операции уже использован")
		return true
	}
	writeJSON(w, http.StatusOK, documentsync.Update{FromVersion: change.FromVersion, Version: change.Version, MutationID: change.MutationID, Patches: change.Patches})
	return true
}
func (s *Server) handleCharacterMutation(w http.ResponseWriter, r *http.Request) {
	user, char, ok := s.loadCharWritable(w, r)
	if !ok {
		return
	}
	mutation, ok := readDocumentMutation(w, r)
	if !ok {
		return
	}
	if s.characterReceipt(w, r, char, user, mutation) {
		return
	}
	if char.Version != mutation.BaseVersion {
		conflict(w, "Лист изменился на сервере")
		return
	}
	data, err := documentpatch.Apply(char.Data, mutation.Patches)
	if err != nil {
		documentPatchError(w, err)
		return
	}
	decoded, err := documentpatch.Decode(data)
	if _, object := decoded.(map[string]any); err != nil || !object {
		badRequest(w, "Данные листа должны быть объектом")
		return
	}
	events := []store.CharacterSessionEvent{}
	for _, metadata := range mutation.Metadata {
		var entry struct {
			Events []characterSessionEventRequest `json:"events"`
		}
		if jsonErr := json.Unmarshal(metadata, &entry); jsonErr != nil {
			badRequest(w, "Некорректные события")
			return
		}
		for _, event := range entry.Events {
			normalized, valid := normalizeCharacterSessionEvent(event)
			if !valid || len(events) >= 50 {
				badRequest(w, "Некорректные события персонажа")
				return
			}
			events = append(events, normalized)
		}
	}
	ctx := store.WithDocumentMutation(store.WithDocumentActor(r.Context(), user), mutation.MutationID, mutation.Fingerprint(), encodeDocument(mutation.Metadata))
	if err = s.store.UpdateCharacterDataWithEvents(ctx, user, char, data, events); err != nil {
		if errors.Is(err, store.ErrCharacterVersion) {
			if s.characterReceipt(w, r, char, user, mutation) {
				return
			}
			conflict(w, "Лист изменился на сервере")
		} else if errors.Is(err, store.ErrNotFound) {
			forbidden(w)
		} else {
			serverError(w, err)
		}
		return
	}
	changes, err := s.store.CharacterMutation(r.Context(), char.ID, mutation.MutationID)
	if err != nil {
		serverError(w, err)
		return
	}
	s.publishCharacterChange(r.Context(), char.ID)
	for _, event := range events {
		if session, err := s.store.GetGameSessionByUUID(r.Context(), event.SessionUUID); err == nil {
			s.publishSessionJournal(session.ID)
		}
	}
	writeJSON(w, http.StatusOK, documentsync.Update{FromVersion: char.Version, Version: char.Version + 1, MutationID: mutation.MutationID, Patches: changes.Patches})
}
func (s *Server) handleCharacterChanges(w http.ResponseWriter, r *http.Request) {
	char, ok := s.loadCharReadable(w, r)
	if !ok {
		return
	}
	w.Header().Set("Cache-Control", "no-store")
	after := documentVersion(r)
	result := documentsync.Update{FromVersion: after, Version: char.Version, Patches: []documentpatch.Operation{}, Metadata: encodeDocument(map[string]any{
		"sourceVersionId": char.SourceVersionID, "sourceVersion": char.SourceVersion, "iconImageId": char.IconImageID, "iconImageUrl": char.IconImageURL, "publicVisible": char.PublicVisible,
	})}
	if after != char.Version {
		// A public current sheet does not grant access to values removed while
		// it was private. Only owners and session GMs receive historical deltas.
		private := char
		private.PublicVisible = false
		user, authed := optionalUser(r)
		replay, err := canReadCharacter(r.Context(), s.store, private, user, authed)
		if err != nil {
			serverError(w, err)
			return
		}
		if !replay {
			result.Data = char.Data
			writeJSON(w, http.StatusOK, result)
			return
		}
		changes, err := s.store.CharacterChanges(r.Context(), char.ID, after)
		if err != nil {
			serverError(w, err)
			return
		}
		at := after
		for _, change := range changes {
			if change.FromVersion != at || change.Version > char.Version {
				break
			}
			result.Patches = append(result.Patches, change.Patches...)
			at = change.Version
		}
		if at != char.Version || len(result.Patches) > 10000 {
			result.Patches = []documentpatch.Operation{}
			result.Data = char.Data
		}
	}
	w.Header().Set("Cache-Control", "no-store")
	writeJSON(w, http.StatusOK, result)
}
func (s *Server) handleCharacterHistory(w http.ResponseWriter, r *http.Request) {
	_, char, ok := s.loadCharWritable(w, r)
	if !ok {
		return
	}
	before, _ := strconv.ParseInt(r.URL.Query().Get("before"), 10, 64)
	changes, err := s.store.CharacterHistory(r.Context(), char.ID, before)
	if err != nil {
		serverError(w, err)
		return
	}
	w.Header().Set("Cache-Control", "no-store")
	writeJSON(w, http.StatusOK, map[string]any{"changes": changes})
}
