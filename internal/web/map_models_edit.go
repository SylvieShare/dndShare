package web

import (
	"errors"
	"net/http"
	"strings"

	"dndshare/internal/battlemap"
	"dndshare/internal/store"
)

func init() { registerRoutes((*Server).routesMapModelEditing) }
func (s *Server) routesMapModelEditing(mux *http.ServeMux) {
	mux.HandleFunc("PUT /api/maps/models/{modelId}", s.mapAdminOnly(s.handleEditMapModel))
}

func editedMapModel(original battlemap.Model, input battlemap.ModelMetadata) (battlemap.Model, error) {
	if input.ID != original.ID || input.Version != original.Version || input.Collection != original.Collection || input.CollectionName != original.CollectionName || input.SourceCode != original.SourceCode || input.SourceName != original.SourceName {
		return original, errors.New("Исходный код, коллекция и версия тайла не редактируются")
	}
	input.Name = strings.TrimSpace(input.Name)
	input.TerrainType = strings.TrimSpace(input.TerrainType)
	input.WallLayout = strings.TrimSpace(input.WallLayout)
	model := battlemap.Model{ModelMetadata: input, Assets: original.Assets}
	if err := validateMapModel(model); err != nil {
		return original, err
	}
	return model, nil
}

func (s *Server) handleEditMapModel(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("modelId")
	if !isUUID(id) {
		badRequest(w, "Некорректный идентификатор тайла")
		return
	}
	var input battlemap.ModelMetadata
	if decodeJSON(r, &input) != nil {
		badRequest(w, "Некорректные параметры тайла")
		return
	}
	original, err := s.store.GetMapModel(r.Context(), id)
	if err != nil {
		mapError(w, err)
		return
	}
	edited, err := editedMapModel(original, input)
	if err != nil {
		badRequest(w, "Некорректные параметры тайла: "+err.Error())
		return
	}
	edited.ID, err = newUUID()
	if err != nil {
		serverError(w, err)
		return
	}
	saved, err := s.store.ReviseMapModel(r.Context(), id, edited)
	if errors.Is(err, store.ErrMapModelConflict) {
		conflict(w, "Параметры тайла уже изменены. Обновите справочник перед сохранением.")
		return
	}
	if err != nil {
		mapError(w, err)
		return
	}
	w.Header().Set("Cache-Control", "no-store")
	writeJSON(w, http.StatusOK, modelView(saved, saved, "/api/maps/models"))
}
