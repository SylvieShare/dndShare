package web

import (
	"dndshare/internal/battlemap"
	"dndshare/internal/store"
	"net/http"
	"strings"
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
	m, err := s.findMap(r, uid, req.MapID)
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

func (s *Server) handleSaveSessionMap(w http.ResponseWriter, r *http.Request) {
	_, sid, ok := s.mapSession(w, r)
	if !ok {
		return
	}
	id := r.PathValue("mapId")
	if !isUUID(id) {
		notFound(w, "")
		return
	}
	var req struct {
		Revision int64               `json:"revision"`
		State    battlemap.State     `json:"state"`
		Name     string              `json:"name"`
		Document *battlemap.Document `json:"document"`
	}
	if decodeJSON(r, &req) != nil {
		badRequest(w, "")
		return
	}
	m, err := s.store.GetSessionMap(r.Context(), sid, id)
	if err != nil {
		mapError(w, err)
		return
	}
	req.Name = strings.TrimSpace(req.Name)
	if req.Document == nil || req.Name == "" || len([]rune(req.Name)) > 160 {
		badRequest(w, "Некорректная карта сессии")
		return
	}
	m.Name, m.Document, m.State, m.Revision = req.Name, *req.Document, req.State, req.Revision
	if err := s.store.PrepareMapDocument(r.Context(), &m.Document); err != nil {
		mapError(w, err)
		return
	}
	if err := battlemap.ValidateState(&req.State, m.Document); err != nil {
		badRequest(w, err.Error())
		return
	}
	m.State = req.State
	models, err := s.store.MapModelsForDocument(r.Context(), m.Document)
	if err != nil {
		mapError(w, err)
		return
	}
	for _, token := range req.State.Tokens {
		if err := battlemap.ValidateSurfaceAnchor(m.Document, models, token.Placement, token.X, token.Y); err != nil {
			badRequest(w, err.Error())
			return
		}
	}
	m, err = s.store.SaveSessionMap(r.Context(), sid, m)
	if err != nil {
		mapError(w, err)
		return
	}
	if err := s.store.HydrateSessionMapLights(r.Context(), &m); err != nil {
		serverError(w, err)
		return
	}
	s.mapEvents.publish(sid)
	writeJSON(w, http.StatusOK, m)
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
		if _, err := s.store.GetSessionMap(r.Context(), sid, *m.MapID); err != nil {
			mapError(w, err)
			return
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
	session, ok := s.publicMapSession(w, r)
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
		value.Source = nil
		value.State = battlemap.PublicState(value.Document, value.State)
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
