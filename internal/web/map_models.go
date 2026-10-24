package web

import (
	"net/http"
	"net/url"

	"dndshare/internal/battlemap"
)

func init() { registerRoutes((*Server).routesMapModels) }
func (s *Server) routesMapModels(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/maps/models", s.mapUserOnly(s.handleMapModels))
	mux.HandleFunc("GET /api/maps/models/{modelId}/{variant}", s.mapUserOnly(s.handleMapModelAsset))
	mux.HandleFunc("GET /api/public/sessions/{code}/map-models", s.handlePublicMapModels)
	mux.HandleFunc("GET /api/public/sessions/{code}/map-models/{modelId}/{variant}", s.handlePublicMapModelAsset)
}

type mapModelView struct {
	ItemIDs []int64 `json:"itemIds,omitempty"`
	battlemap.ModelMetadata
	Behaviour        battlemap.ModelBehaviour `json:"behaviour"`
	RenderURL        string                   `json:"renderUrl"`
	LODURL           string                   `json:"lodUrl"`
	PreviewURL       string                   `json:"previewUrl"`
	ShadowURL        string                   `json:"shadowUrl"`
	AssetBytes       map[string]int64         `json:"assetBytes,omitempty"`
	PreviewSignature string                   `json:"previewSignature,omitempty"`
}

func modelView(model battlemap.Model, base string) mapModelView {
	path := base + "/" + model.ID
	metadata := model.ModelMetadata
	assetURL := func(kind string) string { return path + "/" + kind + "?sha=" + model.Assets[kind].SHA256 }
	shadowURL := assetURL("shadow")
	if model.Assets["shadow"].Key == model.Assets["lod"].Key {
		shadowURL = assetURL("lod")
	}
	sizes := map[string]int64{}
	for _, kind := range []string{"render", "lod", "shadow", "preview"} {
		sizes[kind] = model.Assets[kind].Size
	}
	if shadowURL == assetURL("lod") {
		sizes["shadow"] = sizes["lod"]
	}
	return mapModelView{ModelMetadata: metadata, Behaviour: battlemap.ModelBehaviour{DefaultLights: []battlemap.ModelLight{}, Transitions: []battlemap.ModelTransition{}}, RenderURL: assetURL("render"), LODURL: assetURL("lod"), ShadowURL: shadowURL, PreviewURL: assetURL("preview"), AssetBytes: sizes}

}

func (s *Server) handleMapModels(w http.ResponseWriter, r *http.Request) {
	models, err := s.store.ListMapModels(r.Context())
	if err != nil {
		serverError(w, err)
		return
	}
	preferred, err := s.store.PreferredItemModels(r.Context())
	if err != nil {
		serverError(w, err)
		return
	}
	result := []mapModelView{}
	behaviours, err := s.store.MapModelBehaviours(r.Context())
	if err != nil {
		serverError(w, err)
		return
	}
	for _, m := range models {
		view := modelView(m, "/api/maps/models")
		view.ItemIDs = preferred[m.ID]
		view.Behaviour = behaviours[m.DefinitionID]
		if err := signMapPreviewModel(&view); err != nil {
			serverError(w, err)
			return
		}
		result = append(result, view)
	}
	w.Header().Set("Cache-Control", "no-store")
	writeJSON(w, http.StatusOK, result)
}

func (s *Server) publicModelIDs(w http.ResponseWriter, r *http.Request) (map[string]bool, bool) {
	session, ok := s.publicDisplaySession(w, r)
	if !ok {
		return nil, false
	}
	display, err := s.store.GetMapDisplay(r.Context(), session.ID)
	if err != nil {
		mapError(w, err)
		return nil, false
	}
	ids := map[string]bool{}
	if display.Visible && display.MapID != nil {
		m, err := s.store.GetSessionMap(r.Context(), session.ID, *display.MapID)
		if err != nil {
			mapError(w, err)
			return nil, false
		}
		publicState, err := s.publicMapTokenState(r, session, m.Document, m.State)
		if err != nil {
			serverError(w, err)
			return nil, false
		}
		preferred, err := s.store.PreferredItemModels(r.Context())
		if err != nil {
			serverError(w, err)
			return nil, false
		}
		visibleItems := map[int64]bool{}
		baseIDs := []string{}
		for _, token := range publicState.Tokens {
			if !token.Dead && token.Kind == "creature" && token.ItemID > 0 {
				visibleItems[token.ItemID] = true
				if publicState.UseCreatureBases && token.BaseModelID != "" {
					baseIDs = append(baseIDs, token.BaseModelID)
				}
			}
		}
		for modelID, itemIDs := range preferred {
			for _, itemID := range itemIDs {
				if visibleItems[itemID] {
					ids[modelID] = true
				}
			}
		}
		baseSizes, err := s.store.CreatureBaseSizes(r.Context(), baseIDs)
		if err != nil {
			serverError(w, err)
			return nil, false
		}
		for _, token := range publicState.Tokens {
			if token.Kind == "creature" && visibleItems[token.ItemID] && publicState.UseCreatureBases && baseSizes[token.BaseModelID] == token.Size && token.BaseModelID != "" {
				ids[token.BaseModelID] = true
			}
		}
		for _, t := range m.Document.Tiles {
			ids[t.ModelID] = true
		}
		for _, object := range m.Document.Objects {
			if object.ModelID != "" {
				ids[object.ModelID] = true
			}
		}
	}
	return ids, true
}

func (s *Server) handlePublicMapModels(w http.ResponseWriter, r *http.Request) {
	ids, ok := s.publicModelIDs(w, r)
	if !ok {
		return
	}
	models, err := s.store.ListMapModels(r.Context())
	if err != nil {
		serverError(w, err)
		return
	}
	preferred, err := s.store.PreferredItemModels(r.Context())
	if err != nil {
		serverError(w, err)
		return
	}
	result := []mapModelView{}
	behaviours, err := s.store.MapModelBehaviours(r.Context())
	if err != nil {
		serverError(w, err)
		return
	}
	for _, m := range models {
		if ids[m.ID] {
			view := modelView(m, "/api/public/sessions/"+url.PathEscape(r.PathValue("code"))+"/map-models")
			view.ItemIDs = preferred[m.ID]
			view.Behaviour = behaviours[m.DefinitionID]
			view.Behaviour.Transitions = []battlemap.ModelTransition{}
			result = append(result, view)
		}
	}
	w.Header().Set("Cache-Control", "no-store")
	writeJSON(w, http.StatusOK, result)
}

func (s *Server) handleMapModelAsset(w http.ResponseWriter, r *http.Request) { s.streamMapModel(w, r) }
func (s *Server) handlePublicMapModelAsset(w http.ResponseWriter, r *http.Request) {
	ids, ok := s.publicModelIDs(w, r)
	if !ok {
		return
	}
	if !ids[r.PathValue("modelId")] || r.PathValue("variant") == "source" {
		notFound(w, "")
		return
	}
	s.streamMapModel(w, r)
}

func (s *Server) streamMapModel(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("modelId")
	if !isUUID(id) {
		notFound(w, "")
		return
	}
	m, err := s.store.GetMapModel(r.Context(), id)
	if err != nil {
		mapError(w, err)
		return
	}
	asset, ok := m.Assets[r.PathValue("variant")]
	if !ok {
		notFound(w, "")
		return
	}
	s.streamModelAsset(w, r, asset, "private")
}
