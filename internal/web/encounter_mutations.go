package web

import (
	"dndshare/internal/documentpatch"
	"dndshare/internal/documentsync"
	"dndshare/internal/store"
	"encoding/json"
	"errors"
	"net/http"
)

func init() { registerRoutes((*Server).routesEncounterMutations) }
func (s *Server) routesEncounterMutations(mux *http.ServeMux) {
	mux.HandleFunc("PATCH /api/sessions/{uuid}/encounter", s.handleEncounterMutation)
	mux.HandleFunc("GET /api/sessions/{uuid}/encounter/changes", s.handleEncounterChanges)
}
func (s *Server) encounterSnapshot(w http.ResponseWriter, r *http.Request) (int64, store.GameSession, documentsync.Snapshot, bool) {
	user, session, ok := s.requireSessionEventAccess(w, r)
	if !ok {
		return 0, session, documentsync.Snapshot{}, false
	}
	if user != session.OwnerUserID {
		forbidden(w)
		return user, session, documentsync.Snapshot{}, false
	}
	data, version, err := s.store.EncounterDocument(r.Context(), session.ID)
	if err != nil {
		serverError(w, err)
		return user, session, documentsync.Snapshot{}, false
	}
	return user, session, documentsync.Snapshot{Data: data, Version: version}, true
}
func (s *Server) handleEncounterChanges(w http.ResponseWriter, r *http.Request) {
	_, session, current, ok := s.encounterSnapshot(w, r)
	if !ok {
		return
	}
	w.Header().Set("Cache-Control", "no-store")
	writeJSON(w, http.StatusOK, documentUpdates.Since("encounter:"+session.UUID, documentVersion(r), current))
}
func (s *Server) handleEncounterMutation(w http.ResponseWriter, r *http.Request) {
	user, session, before, ok := s.encounterSnapshot(w, r)
	if !ok {
		return
	}
	mutation, ok := readDocumentMutation(w, r)
	if !ok {
		return
	}
	key := "encounter:" + session.UUID
	if documentReceipt(w, key, mutation) {
		return
	}
	if before.Version != mutation.BaseVersion {
		conflict(w, "Состояние боя изменилось")
		return
	}
	next, err := documentpatch.Apply(before.Data, mutation.Patches)
	if err != nil {
		documentPatchError(w, err)
		return
	}
	var meta struct {
		Active     bool              `json:"active"`
		Round      int               `json:"round"`
		Combatants []json.RawMessage `json:"combatants"`
	}
	if json.Unmarshal(next, &meta) != nil || meta.Combatants == nil || len(meta.Combatants) > 2000 {
		badRequest(w, "Некорректное состояние боя")
		return
	}
	status := "pending"
	if meta.Active {
		status = "active"
	}
	err = s.store.SaveEncounterDocument(store.WithDocumentActor(r.Context(), user), session.ID, status, meta.Round, string(next), before.Version)
	if err != nil {
		if errors.Is(err, store.ErrCharacterVersion) {
			if !documentReceipt(w, key, mutation) {
				conflict(w, "Состояние боя изменилось")
			}
		} else {
			serverError(w, err)
		}
		return
	}
	data, version, err := s.store.EncounterDocument(r.Context(), session.ID)
	if err != nil {
		serverError(w, err)
		return
	}
	result, err := documentUpdates.Record(key, mutation, before, documentsync.Snapshot{Data: data, Version: version})
	if err != nil {
		serverError(w, err)
		return
	}

	s.displayEvents.publish(session.ID)
	s.publishSessionJournal(session.ID)
	writeJSON(w, http.StatusOK, result)
}
