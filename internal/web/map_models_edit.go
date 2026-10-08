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
	if input.ID != original.ID || input.DefinitionID != original.DefinitionID || input.Collection != original.Collection || input.CollectionName != original.CollectionName || input.SourceCode != original.SourceCode || input.SourceName != original.SourceName || input.Hidden != original.Hidden {
		return original, errors.New("Исходный код, коллекция тайла не редактируются")
	}
	input.Name = strings.TrimSpace(input.Name)
	input.Code = strings.TrimSpace(input.Code)
	if !battlemap.ValidModelGroupCode(input.Code) {
		return original, errors.New("Укажите код группы, например UD-door")
	}
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
	var input struct {
		battlemap.ModelMetadata
		LogicalID string                    `json:"id"`
		UUID      string                    `json:"uuid"`
		Behaviour *battlemap.ModelBehaviour `json:"behaviour"`
	}
	if decodeJSON(r, &input) != nil {
		badRequest(w, "Некорректные параметры тайла")
		return
	}
	input.ModelMetadata.ID, input.DefinitionID = input.UUID, input.LogicalID
	original, err := s.store.GetMapModel(r.Context(), id)
	if err != nil {
		mapError(w, err)
		return
	}
	edited, err := editedMapModel(original, input.ModelMetadata)
	if err != nil {
		badRequest(w, "Некорректные параметры тайла: "+err.Error())
		return
	}
	saved, err := s.store.UpdateMapModelWithBehaviour(r.Context(), id, edited, input.Behaviour)
	if errors.Is(err, store.ErrMapModelConflict) {
		conflict(w, "Параметры тайла уже изменены. Обновите справочник перед сохранением.")
		return
	}
	if err != nil {
		if errors.Is(err, store.ErrInvalidMapModels) {
			badRequest(w, strings.TrimPrefix(err.Error(), store.ErrInvalidMapModels.Error()+": "))
			return
		}
		mapError(w, err)
		return
	}
	w.Header().Set("Cache-Control", "no-store")
	behaviours, err := s.store.MapModelBehaviours(r.Context())
	if err != nil {
		serverError(w, err)
		return
	}
	view := modelView(saved, "/api/maps/models")
	view.Behaviour = behaviours[saved.DefinitionID]
	writeJSON(w, http.StatusOK, view)
}
