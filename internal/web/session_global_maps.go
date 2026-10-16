package web

import (
	"dndshare/internal/globalmap"
	"dndshare/internal/store"
	"errors"
	"net/http"
	"strings"
)

func init() { registerRoutes((*Server).routesGlobalMaps) }
func (s *Server) routesGlobalMaps(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/sessions/{uuid}/global-maps", s.handleListGlobalMaps)
	mux.HandleFunc("POST /api/sessions/{uuid}/global-maps", s.handleCreateGlobalMap)
	mux.HandleFunc("PUT /api/sessions/{uuid}/global-maps/{mapId}", s.handleSaveGlobalMap)
	mux.HandleFunc("DELETE /api/sessions/{uuid}/global-maps/{mapId}", s.handleDeleteGlobalMap)
	mux.HandleFunc("POST /api/sessions/{uuid}/global-maps/{mapId}/activate", s.handleActivateGlobalMap)
	mux.HandleFunc("GET /api/sessions/{uuid}/global-map-events", s.handlePrivateMapEvents)
}
func globalMapError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, store.ErrNotFound):
		notFound(w, "")
	case errors.Is(err, store.ErrMapConflict):
		conflict(w, "Карта изменена в другом окне. Загрузите актуальную версию перед продолжением.")
	case errors.Is(err, store.ErrInvalidWorldReference):
		badRequest(w, "Карта, изображение, глава или игрок недоступны в этой сессии. Обновите список и проверьте привязки.")
	default:
		serverError(w, err)
	}
}
func (s *Server) handleListGlobalMaps(w http.ResponseWriter, r *http.Request) {
	_, sid, ok := s.mapSession(w, r)
	if !ok {
		return
	}
	maps, err := s.store.ListGlobalMaps(r.Context(), sid)
	if err != nil {
		globalMapError(w, err)
		return
	}
	w.Header().Set("Cache-Control", "no-store")
	writeJSON(w, http.StatusOK, map[string]any{"maps": maps})
}
func (s *Server) handleCreateGlobalMap(w http.ResponseWriter, r *http.Request) {
	uid, sid, ok := s.mapSession(w, r)
	if !ok {
		return
	}
	var req struct {
		Name    string `json:"name"`
		ImageID int64  `json:"imageId"`
	}
	if decodeJSON(r, &req) != nil {
		badRequest(w, "")
		return
	}
	req.Name = strings.TrimSpace(req.Name)
	if err := globalmap.Validate(req.Name, nil); err != nil {
		badRequest(w, err.Error())
		return
	}
	m, err := s.store.CreateGlobalMap(r.Context(), sid, uid, req.ImageID, req.Name)
	if err != nil {
		globalMapError(w, err)
		return
	}
	s.mapEvents.publish(sid)
	writeJSON(w, http.StatusOK, m)
}
func (s *Server) handleSaveGlobalMap(w http.ResponseWriter, r *http.Request) {
	_, sid, ok := s.mapSession(w, r)
	if !ok {
		return
	}
	var m store.GlobalMap
	if decodeJSON(r, &m) != nil {
		badRequest(w, "")
		return
	}
	m.ID = r.PathValue("mapId")
	m.Name = strings.TrimSpace(m.Name)
	if !isUUID(m.ID) {
		notFound(w, "")
		return
	}
	if err := globalmap.Validate(m.Name, m.Routes); err != nil {
		badRequest(w, err.Error())
		return
	}
	if m.Routes == nil {
		m.Routes = []globalmap.Route{}
	}
	saved, err := s.store.SaveGlobalMap(r.Context(), sid, m)
	if err != nil {
		if errors.Is(err, store.ErrInvalidWorldReference) {
			conflict(w, "Состав игроков или главы сессии изменились. Загрузите актуальную карту и проверьте привязки.")
			return
		}
		globalMapError(w, err)
		return
	}
	s.mapEvents.publish(sid)
	writeJSON(w, http.StatusOK, saved)
}
func (s *Server) handleActivateGlobalMap(w http.ResponseWriter, r *http.Request) {
	_, sid, ok := s.mapSession(w, r)
	if !ok {
		return
	}
	id := r.PathValue("mapId")
	if !isUUID(id) {
		notFound(w, "")
		return
	}
	if err := s.store.ActivateGlobalMap(r.Context(), sid, id); err != nil {
		globalMapError(w, err)
		return
	}
	s.mapEvents.publish(sid)
	w.WriteHeader(http.StatusNoContent)
}
func (s *Server) handleDeleteGlobalMap(w http.ResponseWriter, r *http.Request) {
	_, sid, ok := s.mapSession(w, r)
	if !ok {
		return
	}
	id := r.PathValue("mapId")
	if !isUUID(id) {
		notFound(w, "")
		return
	}
	if err := s.store.DeleteGlobalMap(r.Context(), sid, id); err != nil {
		globalMapError(w, err)
		return
	}
	s.mapEvents.publish(sid)
	w.WriteHeader(http.StatusNoContent)
}
