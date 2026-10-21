package web

import (
	"dndshare/internal/documentpatch"
	"dndshare/internal/documentsync"
	"dndshare/internal/globalmap"
	"dndshare/internal/store"
	"encoding/json"
	"net/http"
	"strings"
)

func globalMapSnapshot(m store.GlobalMap) documentsync.Snapshot {
	return documentsync.Snapshot{Version: m.Revision, Data: encodeDocument(map[string]any{"name": m.Name, "routes": m.Routes}), Metadata: encodeDocument(map[string]any{"id": m.ID, "imageId": m.ImageID, "imageUrl": m.ImageURL, "current": m.Current})}
}
func (s *Server) globalMapDocument(w http.ResponseWriter, r *http.Request) (int64, store.GlobalMap, bool) {
	_, sid, ok := s.mapSession(w, r)
	if !ok {
		return 0, store.GlobalMap{}, false
	}
	id := r.PathValue("mapId")
	if !isUUID(id) {
		notFound(w, "")
		return 0, store.GlobalMap{}, false
	}
	maps, err := s.store.ListGlobalMaps(r.Context(), sid)
	if err != nil {
		globalMapError(w, err)
		return 0, store.GlobalMap{}, false
	}
	for _, m := range maps {
		if m.ID == id {
			return sid, m, true
		}
	}
	notFound(w, "")
	return 0, store.GlobalMap{}, false
}
func (s *Server) handleGlobalMapChanges(w http.ResponseWriter, r *http.Request) {
	_, m, ok := s.globalMapDocument(w, r)
	if !ok {
		return
	}
	w.Header().Set("Cache-Control", "no-store")
	writeJSON(w, http.StatusOK, documentUpdates.Since("global-map:"+m.ID, documentVersion(r), globalMapSnapshot(m)))
}
func (s *Server) handleGlobalMapMutation(w http.ResponseWriter, r *http.Request) {
	sid, m, ok := s.globalMapDocument(w, r)
	if !ok {
		return
	}
	mutation, ok := readDocumentMutation(w, r)
	if !ok {
		return
	}
	key := "global-map:" + m.ID
	if documentReceipt(w, key, mutation) {
		return
	}
	if m.Revision != mutation.BaseVersion {
		conflict(w, "Карта изменилась")
		return
	}
	if !validDocumentRoots(mutation.Patches, "name", "routes") {
		badRequest(w, "Недоступное поле карты")
		return
	}
	before := globalMapSnapshot(m)
	next, err := documentpatch.Apply(before.Data, mutation.Patches)
	if err != nil {
		documentPatchError(w, err)
		return
	}
	var edited struct {
		Name   string            `json:"name"`
		Routes []globalmap.Route `json:"routes"`
	}
	if json.Unmarshal(next, &edited) != nil {
		badRequest(w, "Некорректная карта")
		return
	}
	m.Name = strings.TrimSpace(edited.Name)
	m.Routes = edited.Routes
	if err = globalmap.Validate(m.Name, m.Routes); err != nil {
		badRequest(w, err.Error())
		return
	}
	if m.Routes == nil {
		m.Routes = []globalmap.Route{}
	}
	saved, err := s.store.SaveGlobalMap(r.Context(), sid, m)
	if err != nil {
		globalMapError(w, err)
		return
	}
	result, err := documentUpdates.Record(key, mutation, before, globalMapSnapshot(saved))
	if err != nil {
		serverError(w, err)
		return
	}
	s.mapEvents.publish(sid)
	writeJSON(w, http.StatusOK, result)
}
