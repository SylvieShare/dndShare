package web

import (
	"io"
	"log"
	"net/http"
	"net/url"
	"strconv"

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
	battlemap.ModelMetadata
	Behaviour  battlemap.ModelBehaviour `json:"behaviour"`
	RenderURL  string                   `json:"renderUrl"`
	LODURL     string                   `json:"lodUrl"`
	PreviewURL string                   `json:"previewUrl"`
	ShadowURL  string                   `json:"shadowUrl"`
}

func modelView(model battlemap.Model, base string) mapModelView {
	path := base + "/" + model.ID
	metadata := model.ModelMetadata
	assetURL := func(kind string) string { return path + "/" + kind + "?sha=" + model.Assets[kind].SHA256 }
	shadowURL := assetURL("shadow")
	if model.Assets["shadow"].Key == model.Assets["lod"].Key {
		shadowURL = assetURL("lod")
	}
	return mapModelView{ModelMetadata: metadata, Behaviour: battlemap.ModelBehaviour{DefaultLights: []battlemap.ModelLight{}, Transitions: []battlemap.ModelTransition{}}, RenderURL: assetURL("render"), LODURL: assetURL("lod"), ShadowURL: shadowURL, PreviewURL: assetURL("preview")}

}

func (s *Server) handleMapModels(w http.ResponseWriter, r *http.Request) {
	models, err := s.store.ListMapModels(r.Context())
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
		view.Behaviour = behaviours[m.DefinitionID]
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
	result := []mapModelView{}
	behaviours, err := s.store.MapModelBehaviours(r.Context())
	if err != nil {
		serverError(w, err)
		return
	}
	for _, m := range models {
		if ids[m.ID] {
			view := modelView(m, "/api/public/sessions/"+url.PathEscape(r.PathValue("code"))+"/map-models")
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
	if sha := r.URL.Query().Get("sha"); sha != "" && sha != asset.SHA256 {
		notFound(w, "")
		return
	}
	etag := `"` + asset.SHA256 + `"`
	if r.URL.Query().Get("sha") != "" {
		if r.URL.Query().Get("sha") != "" {
			w.Header().Set("Cache-Control", "private, max-age=31536000, immutable")
		} else {
			w.Header().Set("Cache-Control", "no-cache")
		}
	} else {
		w.Header().Set("Cache-Control", "no-cache")
	}
	w.Header().Set("ETag", etag)
	if r.Header.Get("If-None-Match") == etag {
		w.WriteHeader(http.StatusNotModified)
		return
	}
	body, err := s.s3.GetObject(r.Context(), asset.Key)
	if err != nil {
		serverError(w, err)
		return
	}
	defer body.Body.Close()
	w.Header().Set("Content-Type", asset.MimeType)
	w.Header().Set("Content-Length", strconv.FormatInt(body.ContentLength, 10))
	w.Header().Set("X-Content-Type-Options", "nosniff")
	if _, err := io.Copy(w, body.Body); err != nil {
		log.Printf("stream map model %s: %v", id, err)
	}
}
