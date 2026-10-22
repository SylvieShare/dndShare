package web

import (
	"dndshare/internal/battlemap"
	"dndshare/internal/documentpatch"
	"dndshare/internal/documentsync"
	"dndshare/internal/store"
	"encoding/json"
	"errors"
	"net/http"
	"strings"
)

func init() { registerRoutes((*Server).routesMapMutations) }
func (s *Server) routesMapMutations(mux *http.ServeMux) {
	mux.HandleFunc("PATCH /api/maps/{mapId}", s.mapUserOnly(s.handleMapMutation))
	mux.HandleFunc("GET /api/maps/{mapId}/changes", s.mapUserOnly(s.handleMapChanges))
	mux.HandleFunc("PATCH /api/sessions/{uuid}/maps/{mapId}", s.mapUserOnly(s.handleSessionMapMutation))
	mux.HandleFunc("GET /api/sessions/{uuid}/maps/{mapId}/changes", s.mapUserOnly(s.handleSessionMapChanges))
}

type mapMutationData struct {
	Name     string             `json:"name"`
	Document battlemap.Document `json:"document"`
}

func mapSnapshot(m store.BattleMap) documentsync.Snapshot {
	return documentsync.Snapshot{Version: m.Revision, Data: encodeDocument(mapMutationData{m.Name, m.Document}), Metadata: encodeDocument(map[string]any{
		"id": m.ID, "revision": m.Revision, "changedAt": m.ChangedAt, "owned": m.Owned, "publishedAt": m.PublishedAt,
		"previewUrl": m.PreviewURL, "previewSignature": m.PreviewSignature, "previewStale": m.PreviewStale, "previewModelsSignature": m.PreviewModelsSignature,
	})}
}
func (s *Server) hydrateMapMutation(r *http.Request, m *store.BattleMap) error {
	models, behaviours, err := s.store.HydrateMapCatalogue(r.Context(), &m.Document)
	if err != nil {
		return err
	}
	return s.attachMapPreview(r, m, models, behaviours)
}
func (s *Server) handleMapChanges(w http.ResponseWriter, r *http.Request) {
	user, ok := mustUser(w, r)
	if !ok {
		return
	}
	m, err := s.findMap(r, user, r.PathValue("mapId"))
	if err != nil {
		mapError(w, err)
		return
	}
	if err = s.hydrateMapMutation(r, &m); err != nil {
		mapError(w, err)
		return
	}
	w.Header().Set("Cache-Control", "no-store")
	writeJSON(w, http.StatusOK, documentUpdates.Since("map:"+m.ID, documentVersion(r), mapSnapshot(m)))
}
func (s *Server) handleMapMutation(w http.ResponseWriter, r *http.Request) {
	user, ok := mustUser(w, r)
	if !ok {
		return
	}
	id := r.PathValue("mapId")
	if !isUUID(id) {
		notFound(w, "")
		return
	}
	m, err := s.store.GetBattleMap(r.Context(), user, id)
	if err != nil {
		mapError(w, err)
		return
	}
	if m.PublishedAt != nil {
		forbidden(w)
		return
	}
	mutation, ok := readDocumentMutation(w, r)
	if !ok {
		return
	}
	key := "map:" + id
	if documentReceipt(w, key, mutation) {
		return
	}
	if mutation.BaseVersion != m.Revision {
		conflict(w, "Карта изменилась")
		return
	}
	if !validDocumentRoots(mutation.Patches, "name", "document") {
		badRequest(w, "Недоступное поле карты")
		return
	}
	if err = s.hydrateMapMutation(r, &m); err != nil {
		mapError(w, err)
		return
	}
	before := mapSnapshot(m)
	updated, err := documentpatch.Apply(before.Data, mutation.Patches)
	if err != nil {
		documentPatchError(w, err)
		return
	}
	var data mapMutationData
	if json.Unmarshal(updated, &data) != nil {
		badRequest(w, "Некорректные данные карты")
		return
	}
	data.Name = strings.TrimSpace(data.Name)
	if data.Name == "" || len([]rune(data.Name)) > 160 {
		badRequest(w, "Укажите название карты")
		return
	}
	if data.Document.Kind != "tiles" {
		badRequest(w, "Заготовка должна быть 3D-картой")
		return
	}
	if err = battlemap.ValidateDocument(&data.Document); err != nil {
		badRequest(w, err.Error())
		return
	}
	if err = s.store.PrepareMapDocument(r.Context(), &data.Document); err != nil {
		mapError(w, err)
		return
	}
	m.Name, m.Document = data.Name, data.Document
	m, err = s.store.SaveBattleMap(r.Context(), user, m)
	if err != nil {
		if errors.Is(err, store.ErrMapConflict) && documentReceipt(w, key, mutation) {
			return
		}
		mapError(w, err)
		return
	}
	if err = s.hydrateMapMutation(r, &m); err != nil {
		mapError(w, err)
		return
	}
	result, err := documentUpdates.Record(key, mutation, before, mapSnapshot(m))
	if err != nil {
		serverError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, result)
}

type sessionMapMutationData struct {
	Name     string             `json:"name"`
	Document battlemap.Document `json:"document"`
	State    battlemap.State    `json:"state"`
}

func sessionMapSnapshot(m store.SessionMap) documentsync.Snapshot {
	return documentsync.Snapshot{Version: m.Revision, Data: encodeDocument(sessionMapMutationData{m.Name, m.Document, m.State}), Metadata: encodeDocument(map[string]any{"id": m.ID, "revision": m.Revision, "changedAt": m.ChangedAt})}
}
func (s *Server) handleSessionMapChanges(w http.ResponseWriter, r *http.Request) {
	_, sid, ok := s.mapSession(w, r)
	if !ok {
		return
	}
	id := r.PathValue("mapId")
	if !isUUID(id) {
		notFound(w, "")
		return
	}
	m, err := s.store.GetSessionMap(r.Context(), sid, id)
	if err != nil {
		mapError(w, err)
		return
	}
	if err = s.store.HydrateSessionMapLights(r.Context(), &m); err != nil {
		mapError(w, err)
		return
	}
	w.Header().Set("Cache-Control", "no-store")
	hydrateMapImage(&m, "/api/sessions/"+r.PathValue("uuid"))
	writeJSON(w, http.StatusOK, documentUpdates.Since("session-map:"+id, documentVersion(r), sessionMapSnapshot(m)))
}
func (s *Server) handleSessionMapMutation(w http.ResponseWriter, r *http.Request) {
	_, sid, ok := s.mapSession(w, r)
	if !ok {
		return
	}
	id := r.PathValue("mapId")
	if !isUUID(id) {
		notFound(w, "")
		return
	}
	m, err := s.store.GetSessionMap(r.Context(), sid, id)
	if err != nil {
		mapError(w, err)
		return
	}
	mutation, ok := readDocumentMutation(w, r)
	if !ok {
		return
	}
	key := "session-map:" + id
	if documentReceipt(w, key, mutation) {
		return
	}
	if mutation.BaseVersion != m.Revision {
		conflict(w, "Карта сессии изменилась")
		return
	}
	if !validDocumentRoots(mutation.Patches, "name", "document", "state") {
		badRequest(w, "Недоступное поле карты")
		return
	}
	if err = s.store.HydrateSessionMapLights(r.Context(), &m); err != nil {
		mapError(w, err)
		return
	}
	hydrateMapImage(&m, "/api/sessions/"+r.PathValue("uuid"))
	before := sessionMapSnapshot(m)
	updated, err := documentpatch.Apply(before.Data, mutation.Patches)
	if err != nil {
		documentPatchError(w, err)
		return
	}
	var data sessionMapMutationData
	if json.Unmarshal(updated, &data) != nil {
		badRequest(w, "Некорректная карта")
		return
	}
	data.Name = strings.TrimSpace(data.Name)
	if data.Name == "" || len([]rune(data.Name)) > 160 {
		badRequest(w, "Укажите название карты")
		return
	}
	if data.Document.Kind != m.Document.Kind || data.Document.Kind == "image" && (data.Document.Image == nil || m.Document.Image == nil || data.Document.Image.ID != m.Document.Image.ID || data.Document.Image.PixelWidth != m.Document.Image.PixelWidth || data.Document.Image.PixelHeight != m.Document.Image.PixelHeight) {
		badRequest(w, "Тип карты и исходное изображение не изменяются")
		return
	}
	if err = s.store.PrepareMapDocument(r.Context(), &data.Document); err != nil {
		mapError(w, err)
		return
	}
	if err = battlemap.ValidateState(&data.State, data.Document); err != nil {
		badRequest(w, err.Error())
		return
	}
	models, err := s.store.MapModelsForDocument(r.Context(), data.Document)
	if err != nil {
		mapError(w, err)
		return
	}
	for _, token := range data.State.Tokens {
		if err = battlemap.ValidateSurfaceAnchor(data.Document, models, token.Placement, token.X, token.Y); err != nil {
			badRequest(w, err.Error())
			return
		}
	}
	m.Name, m.Document, m.State = data.Name, data.Document, data.State
	m, err = s.store.SaveSessionMap(r.Context(), sid, m)
	if err != nil {
		if errors.Is(err, store.ErrMapConflict) && documentReceipt(w, key, mutation) {
			return
		}
		mapError(w, err)
		return
	}
	if err = s.store.HydrateSessionMapLights(r.Context(), &m); err != nil {
		mapError(w, err)
		return
	}
	hydrateMapImage(&m, "/api/sessions/"+r.PathValue("uuid"))
	result, err := documentUpdates.Record(key, mutation, before, sessionMapSnapshot(m))
	if err != nil {
		serverError(w, err)
		return
	}
	s.mapEvents.publish(sid)
	writeJSON(w, http.StatusOK, result)
}
