package web

import (
	"dndshare/internal/store"
	"net/http"
	"strings"
)

func mapRequestIdentity(w http.ResponseWriter, r *http.Request) (int64, string, bool) {
	uid, ok := mustUser(w, r)
	if !ok {
		return 0, "", false
	}
	id := r.PathValue("mapId")
	if !isUUID(id) {
		notFound(w, "")
		return 0, "", false
	}
	return uid, id, true
}
func (s *Server) handleGetMap(w http.ResponseWriter, r *http.Request) {
	uid, id, ok := mapRequestIdentity(w, r)
	if !ok {
		return
	}
	m, err := s.store.GetReadableBattleMap(r.Context(), uid, id)
	if err != nil {
		mapError(w, err)
		return
	}
	if err = s.presentCatalogueMap(r, &m); err != nil {
		mapError(w, err)
		return
	}
	w.Header().Set("Cache-Control", "no-store")
	writeJSON(w, http.StatusOK, m)
}
func (s *Server) presentCatalogueMap(r *http.Request, m *store.MapCatalogueEntry) error {
	models, behaviours, err := s.store.HydrateMapCatalogue(r.Context(), &m.Document)
	if err != nil {
		return err
	}
	return s.attachMapPreview(r, &m.BattleMap, models, behaviours)
}
func (s *Server) handlePublishMap(w http.ResponseWriter, r *http.Request) {
	uid, id, ok := mapRequestIdentity(w, r)
	if !ok {
		return
	}
	var input struct {
		Revision int64 `json:"revision"`
	}
	if decodeJSON(r, &input) != nil || input.Revision < 1 {
		badRequest(w, "Укажите текущую ревизию карты")
		return
	}
	if _, err := s.store.PublishBattleMap(r.Context(), uid, id, input.Revision); err != nil {
		mapError(w, err)
		return
	}
	s.handleGetMap(w, r)
}
func (s *Server) handleCopyMap(w http.ResponseWriter, r *http.Request) {
	uid, id, ok := mapRequestIdentity(w, r)
	if !ok {
		return
	}
	m, err := s.store.GetUsableBattleMap(r.Context(), uid, id)
	if err != nil {
		mapError(w, err)
		return
	}
	name := []rune(strings.TrimSpace(m.Name))
	if len(name) > 150 {
		name = name[:150]
	}
	saved, err := s.store.SaveBattleMap(r.Context(), uid, store.BattleMap{Name: string(name) + " · копия", Document: m.Document})
	if err != nil {
		mapError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, saved)
}
func (s *Server) handleMapSubscription(w http.ResponseWriter, r *http.Request) {
	uid, id, ok := mapRequestIdentity(w, r)
	if !ok {
		return
	}
	if err := s.store.SubscribeMap(r.Context(), uid, id, r.Method == http.MethodPut); err != nil {
		mapError(w, err)
		return
	}
	s.handleGetMap(w, r)
}
func (s *Server) handleMapRating(w http.ResponseWriter, r *http.Request) {
	uid, id, ok := mapRequestIdentity(w, r)
	if !ok {
		return
	}
	var input struct {
		Rating int `json:"rating"`
	}
	if r.Method == http.MethodPut && (decodeJSON(r, &input) != nil || input.Rating < 1 || input.Rating > 5) {
		badRequest(w, "Оценка должна быть от 1 до 5")
		return
	}
	if err := s.store.RateMap(r.Context(), uid, id, input.Rating); err != nil {
		mapError(w, err)
		return
	}
	s.handleGetMap(w, r)
}
