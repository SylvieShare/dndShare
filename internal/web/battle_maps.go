package web

import (
	"errors"
	"net/http"
	"strings"

	"dndshare/internal/battlemap"
	"dndshare/internal/store"
)

func init() { registerRoutes((*Server).routesBattleMaps) }
func (s *Server) routesBattleMaps(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/maps", s.mapAdminOnly(s.handleListMaps))
	mux.HandleFunc("POST /api/maps", s.mapAdminOnly(s.handleSaveMap))
	mux.HandleFunc("PUT /api/maps/{mapId}", s.mapAdminOnly(s.handleSaveMap))
	mux.HandleFunc("DELETE /api/maps/{mapId}", s.mapAdminOnly(s.handleDeleteMap))
	mux.HandleFunc("GET /api/sessions/{uuid}/maps", s.mapAdminOnly(s.handleListSessionMaps))
	mux.HandleFunc("POST /api/sessions/{uuid}/maps", s.mapAdminOnly(s.handleAddSessionMap))
	mux.HandleFunc("PUT /api/sessions/{uuid}/maps/{mapId}", s.mapAdminOnly(s.handleSaveSessionMap))
	mux.HandleFunc("DELETE /api/sessions/{uuid}/maps/{mapId}", s.mapAdminOnly(s.handleDeleteSessionMap))
	mux.HandleFunc("PUT /api/sessions/{uuid}/map-display", s.mapAdminOnly(s.handleSaveMapDisplay))
	mux.HandleFunc("GET /api/sessions/{uuid}/map-events", s.mapAdminOnly(s.handlePrivateMapEvents))
	mux.HandleFunc("GET /api/public/sessions/{code}/map", s.handlePublicMap)
	mux.HandleFunc("GET /api/public/sessions/{code}/map-events", s.handlePublicMapEvents)
}

func mapError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, store.ErrNotFound):
		notFound(w, "")
	case errors.Is(err, store.ErrMapConflict):
		conflict(w, "Карта изменена в другой вкладке. Перезагрузите данные перед сохранением.")
	default:
		serverError(w, err)
	}
}

func (s *Server) findMap(r *http.Request, userID int64, id string) (store.BattleMap, error) {
	for _, p := range battlemap.Presets() {
		if p.ID == id {
			return store.BattleMap{ID: p.ID, Name: p.Name, Document: p.Document, System: true, Revision: 1}, nil
		}
	}
	if !isUUID(id) {
		return store.BattleMap{}, store.ErrNotFound
	}
	return s.store.GetBattleMap(r.Context(), userID, id)
}

func (s *Server) handleListMaps(w http.ResponseWriter, r *http.Request) {
	uid, ok := mustUser(w, r)
	if !ok {
		return
	}
	maps, err := s.store.ListBattleMaps(r.Context(), uid)
	if err != nil {
		mapError(w, err)
		return
	}
	for _, p := range battlemap.Presets() {
		maps = append(maps, store.BattleMap{ID: p.ID, Name: p.Name, Document: p.Document, System: true, Revision: 1})
	}
	documents := make([]*battlemap.Document, 0, len(maps))
	for i := range maps {
		documents = append(documents, &maps[i].Document)
	}
	models, behaviours, err := s.store.HydrateMapCatalogue(r.Context(), documents...)
	if err != nil {
		serverError(w, err)
		return
	}
	for i := range maps {
		if err := s.attachMapPreview(r, &maps[i], models, behaviours); err != nil {
			serverError(w, err)
			return
		}
	}
	w.Header().Set("Cache-Control", "no-store")
	writeJSON(w, http.StatusOK, maps)
}

func (s *Server) handleSaveMap(w http.ResponseWriter, r *http.Request) {
	uid, ok := mustUser(w, r)
	if !ok {
		return
	}
	var m store.BattleMap
	if decodeJSON(r, &m) != nil {
		badRequest(w, "Некорректная карта")
		return
	}
	m.ID = r.PathValue("mapId")
	m.Name = strings.TrimSpace(m.Name)
	if (m.ID != "" && !isUUID(m.ID)) || m.Name == "" || len([]rune(m.Name)) > 160 {
		badRequest(w, "Укажите название карты")
		return
	}
	if m.ID != "" {
		if _, err := s.store.GetBattleMap(r.Context(), uid, m.ID); err != nil {
			mapError(w, err)
			return
		}
	}
	if err := battlemap.ValidateDocument(&m.Document); err != nil {
		badRequest(w, err.Error())
		return
	}
	if err := s.store.PrepareMapDocument(r.Context(), &m.Document); err != nil {
		if errors.Is(err, store.ErrInvalidMapModels) {
			badRequest(w, strings.TrimPrefix(err.Error(), store.ErrInvalidMapModels.Error()+": "))
		} else {
			serverError(w, err)
		}
		return
	}
	m, err := s.store.SaveBattleMap(r.Context(), uid, m)
	if err != nil {
		mapError(w, err)
		return
	}
	models, behaviours, err := s.store.HydrateMapCatalogue(r.Context(), &m.Document)
	if err != nil {
		serverError(w, err)
		return
	}
	if err = s.attachMapPreview(r, &m, models, behaviours); err != nil {
		serverError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, m)
}

func (s *Server) handleDeleteMap(w http.ResponseWriter, r *http.Request) {
	uid, ok := mustUser(w, r)
	if !ok {
		return
	}
	id := r.PathValue("mapId")
	if !isUUID(id) {
		notFound(w, "")
		return
	}
	key, err := s.store.DeleteBattleMapWithPreview(r.Context(), uid, id)
	if err != nil {
		mapError(w, err)
		return
	}
	s.removeMapPreviewObject(r.Context(), key)
	w.WriteHeader(http.StatusNoContent)
}
