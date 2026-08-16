package web

import (
	"errors"
	"net/http"

	"dndshare/internal/store"
)

var presentationEffects = map[string]bool{
	"none": true, "rain": true, "fog": true, "embers": true, "snow": true, "storm": true,
}

var presentationTransitions = map[string]bool{"cut": true, "fade": true}

func normalizePresentationStyle(effect, transition string) (string, string) {
	if effect == "" {
		effect = "none"
	}
	if transition == "" {
		transition = "fade"
	}
	return effect, transition
}

func (s *Server) materialForScene(w http.ResponseWriter, r *http.Request, sessionID, sceneID, materialID int64) (store.SessionMaterial, bool) {
	material, err := s.store.GetSessionMaterial(r.Context(), materialID)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			badRequest(w, "Материал не найден")
		} else {
			serverError(w, err)
		}
		return store.SessionMaterial{}, false
	}
	if material.SessionID != sessionID {
		forbidden(w)
		return store.SessionMaterial{}, false
	}
	scene, err := s.store.GetSceneByID(r.Context(), sceneID)
	if err != nil {
		serverError(w, err)
		return store.SessionMaterial{}, false
	}
	chapter, err := s.store.GetSessionChapter(r.Context(), scene.ChapterID)
	if err != nil || chapter.SessionID != sessionID {
		forbidden(w)
		return store.SessionMaterial{}, false
	}
	return material, true
}

func (s *Server) validateMaterialForScene(w http.ResponseWriter, r *http.Request, sessionID, sceneID, materialID int64) bool {
	material, ok := s.materialForScene(w, r, sessionID, sceneID, materialID)
	if !ok {
		return false
	}
	if material.Kind != "image" && material.Kind != "map" {
		badRequest(w, "Для блока изображения выберите картинку или карту")
		return false
	}
	return true
}
