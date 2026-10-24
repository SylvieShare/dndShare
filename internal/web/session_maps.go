package web

import (
	"dndshare/internal/battlemap"
	"dndshare/internal/store"
	"net/http"
)

func (s *Server) mapSession(w http.ResponseWriter, r *http.Request) (int64, int64, bool) {
	uid, ok := mustUser(w, r)
	if !ok {
		return 0, 0, false
	}
	session, ok := s.requireSceneDm(w, r, uid)
	return uid, session.ID, ok
}

func (s *Server) handleListSessionMaps(w http.ResponseWriter, r *http.Request) {
	_, sid, ok := s.mapSession(w, r)
	if !ok {
		return
	}
	maps, err := s.store.ListSessionMaps(r.Context(), sid)
	if err != nil {
		mapError(w, err)
		return
	}
	presentations := make([]*store.SessionMap, 0, len(maps))
	for i := range maps {
		hydrateMapImage(&maps[i], "/api/sessions/"+r.PathValue("uuid"))
		presentations = append(presentations, &maps[i])
	}
	if err := s.store.HydrateSessionMapLights(r.Context(), presentations...); err != nil {
		serverError(w, err)
		return
	}
	display, err := s.store.GetMapDisplay(r.Context(), sid)
	if err != nil {
		mapError(w, err)
		return
	}
	w.Header().Set("Cache-Control", "no-store")
	writeJSON(w, http.StatusOK, map[string]any{"maps": maps, "display": display})
}

func (s *Server) handleAddSessionMap(w http.ResponseWriter, r *http.Request) {
	uid, sid, ok := s.mapSession(w, r)
	if !ok {
		return
	}
	var req struct {
		MapID string `json:"mapId"`
	}
	if decodeJSON(r, &req) != nil {
		badRequest(w, "")
		return
	}
	if !isUUID(req.MapID) {
		notFound(w, "")
		return
	}
	m, err := s.store.GetUsableBattleMap(r.Context(), uid, req.MapID)
	if err != nil {
		mapError(w, err)
		return
	}
	if err := s.store.HydrateMapLights(r.Context(), &m.Document); err != nil {
		serverError(w, err)
		return
	}
	result, err := s.store.AddSessionMap(r.Context(), sid, m)
	if err != nil {
		mapError(w, err)
		return
	}
	s.mapEvents.publish(sid)
	writeJSON(w, http.StatusOK, result)
}

func (s *Server) handleDeleteSessionMap(w http.ResponseWriter, r *http.Request) {
	_, sid, ok := s.mapSession(w, r)
	if !ok {
		return
	}
	id := r.PathValue("mapId")
	if !isUUID(id) {
		notFound(w, "")
		return
	}
	if err := s.store.DeleteSessionMap(r.Context(), sid, id); err != nil {
		mapError(w, err)
		return
	}
	s.mapEvents.publish(sid)
	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) handleSaveMapDisplay(w http.ResponseWriter, r *http.Request) {
	_, sid, ok := s.mapSession(w, r)
	if !ok {
		return
	}
	var m store.MapDisplay
	if decodeJSON(r, &m) != nil || !battlemap.ValidateCamera(m.Camera) || (m.Visible && m.MapID == nil) {
		badRequest(w, "Некорректные настройки экрана")
		return
	}
	if m.MapID != nil {
		if !isUUID(*m.MapID) {
			badRequest(w, "Некорректная карта")
			return
		}
		if selected, err := s.store.GetSessionMap(r.Context(), sid, *m.MapID); err != nil {
			mapError(w, err)
			return
		} else {
			m.Camera = battlemap.ResolveDisplayCamera(selected.Document, m.Camera)
		}
	}
	m, err := s.store.SaveMapDisplay(r.Context(), sid, m)
	if err != nil {
		mapError(w, err)
		return
	}
	s.mapEvents.publish(sid)
	writeJSON(w, http.StatusOK, m)
}

func (s *Server) handlePublicMap(w http.ResponseWriter, r *http.Request) {
	session, ok := s.publicDisplaySession(w, r)
	if !ok {
		return
	}
	display, err := s.store.GetMapDisplay(r.Context(), session.ID)
	if err != nil {
		mapError(w, err)
		return
	}
	var m *store.SessionMap
	if display.Visible && display.MapID != nil {
		value, err := s.store.GetSessionMap(r.Context(), session.ID, *display.MapID)
		if err != nil {
			mapError(w, err)
			return
		}
		if err := s.store.HydrateSessionMapLights(r.Context(), &value); err != nil {
			serverError(w, err)
			return
		}
		display.Camera = battlemap.ResolveDisplayCamera(value.Document, display.Camera)
		value.Document.Cameras = nil
		hydrateMapImage(&value, "/api/public/sessions/"+r.PathValue("code"))
		value.Source = nil
		value.State, err = s.publicMapTokenState(r, session, value.Document, value.State)
		if err != nil {
			serverError(w, err)
			return
		}
		value.Document.Tags = []string{}
		for i := range value.Document.Zones {
			value.Document.Zones[i].Name = ""
		}
		for i := range value.Document.Areas {
			value.Document.Areas[i].Name = ""
		}
		for i := range value.Document.Lights {
			value.Document.Lights[i].Name = ""
		}
		m = &value
	}
	w.Header().Set("Cache-Control", "no-store")
	writeJSON(w, http.StatusOK, map[string]any{"display": display, "map": m})
}
