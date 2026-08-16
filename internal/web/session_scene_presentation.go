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

func (s *Server) validateMaterialForScene(w http.ResponseWriter, r *http.Request, sessionID, sceneID, materialID int64) bool {
	material, err := s.store.GetSessionMaterial(r.Context(), materialID)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			badRequest(w, "Материал не найден")
		} else {
			serverError(w, err)
		}
		return false
	}
	if material.SessionID != sessionID {
		forbidden(w)
		return false
	}
	if material.Kind != "image" && material.Kind != "map" {
		badRequest(w, "Для блока изображения выберите картинку или карту")
		return false
	}
	if material.Scope == "scene" && (material.SceneID == nil || *material.SceneID != sceneID) {
		badRequest(w, "Материал относится к другому сценарию")
		return false
	}
	if material.Scope == "chapter" {
		scene, err := s.store.GetSceneByID(r.Context(), sceneID)
		if err != nil {
			serverError(w, err)
			return false
		}
		if material.ChapterID == nil || *material.ChapterID != scene.ChapterID {
			badRequest(w, "Материал относится к другой главе")
			return false
		}
	}
	return true
}

func (s *Server) validateScenePresentation(
	w http.ResponseWriter,
	r *http.Request,
	session store.SceneSession,
	userID, chapterID, sceneID int64,
	materialID, trackID *int64,
	volume, crossfade *float64,
	effect, transition string,
) (store.ScenePresentationSettings, bool) {
	effect, transition = normalizePresentationStyle(effect, transition)
	preset := store.ScenePresentationSettings{
		MaterialID: materialID, TrackID: trackID, Volume: volume, CrossfadeSec: crossfade,
		Effect: effect, Transition: transition,
	}
	if !presentationEffects[effect] || !presentationTransitions[transition] {
		badRequest(w, "Некорректные настройки показа")
		return preset, false
	}
	if volume != nil && (*volume < 0 || *volume > 1) {
		badRequest(w, "Громкость должна быть от 0 до 1")
		return preset, false
	}
	if crossfade != nil && (*crossfade < 0 || *crossfade > 15) {
		badRequest(w, "Плавный переход должен быть от 0 до 15 секунд")
		return preset, false
	}
	if materialID != nil {
		material, err := s.store.GetSessionMaterial(r.Context(), *materialID)
		if err != nil {
			badRequest(w, "Материал не найден")
			return preset, false
		}
		if material.SessionID != session.ID || (material.Scope == "chapter" && (material.ChapterID == nil || *material.ChapterID != chapterID)) ||
			(material.Scope == "scene" && (sceneID == 0 || material.SceneID == nil || *material.SceneID != sceneID)) {
			badRequest(w, "Материал недоступен в этом сценарии")
			return preset, false
		}
	}
	if trackID != nil {
		track, err := s.store.GetMusicTrackByID(r.Context(), *trackID)
		if err != nil || (!track.IsSystem && track.OwnerUserID != userID) {
			badRequest(w, "Музыкальный трек недоступен")
			return preset, false
		}
	}
	return preset, true
}
