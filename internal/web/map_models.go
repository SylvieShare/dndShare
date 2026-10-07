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
	mux.HandleFunc("GET /api/maps/models", s.mapAdminOnly(s.handleMapModels))
	mux.HandleFunc("GET /api/maps/models/{modelId}/{variant}", s.mapAdminOnly(s.handleMapModelAsset))
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

func modelView(model, visual battlemap.Model, base string) mapModelView {
	path := base + "/" + model.ID
	query := ""
	if visual.ID != model.ID {
		query = "?revision=" + url.QueryEscape(visual.ID)
	}
	metadata := model.ModelMetadata
	metadata.TextureDetail = visual.TextureDetail
	shadowPath := "/shadow"
	if visual.Assets["shadow"].SHA256 == visual.Assets["lod"].SHA256 {
		shadowPath = "/lod"
	}
	return mapModelView{ModelMetadata: metadata, Behaviour: battlemap.ModelBehaviour{DefaultLights: []battlemap.ModelLight{}, Transitions: []battlemap.ModelTransition{}}, RenderURL: path + "/render" + query, LODURL: path + "/lod" + query, PreviewURL: path + "/preview" + query, ShadowURL: path + shadowPath + query}
}

func (s *Server) handleMapModels(w http.ResponseWriter, r *http.Request) {
	models, err := s.store.ListMapModels(r.Context())
	if err != nil {
		serverError(w, err)
		return
	}
	result := []mapModelView{}
	visuals := battlemap.LatestVisualModels(models)
	behaviours, err := s.store.MapModelBehaviours(r.Context())
	if err != nil {
		serverError(w, err)
		return
	}
	for _, m := range models {
		view := modelView(m, visuals[m.ID], "/api/maps/models")
		view.Behaviour = behaviours[m.DefinitionID]
		result = append(result, view)
	}
	w.Header().Set("Cache-Control", "no-store")
	writeJSON(w, http.StatusOK, result)
}

func (s *Server) publicModelIDs(w http.ResponseWriter, r *http.Request) (map[string]bool, bool) {
	session, ok := s.publicMapSession(w, r)
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
	visuals := battlemap.LatestVisualModels(models)
	behaviours, err := s.store.MapModelBehaviours(r.Context())
	if err != nil {
		serverError(w, err)
		return
	}
	for _, m := range models {
		if ids[m.ID] {
			view := modelView(m, visuals[m.ID], "/api/public/sessions/"+url.PathEscape(r.PathValue("code"))+"/map-models")
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
	if revision := r.URL.Query().Get("revision"); revision != "" {
		if !isUUID(revision) || r.PathValue("variant") == "source" {
			notFound(w, "")
			return
		}
		visual, err := s.store.GetMapModel(r.Context(), revision)
		if err != nil || !battlemap.VisualRevision(m, visual) {
			notFound(w, "")
			return
		}
		m = visual
	}
	asset, ok := m.Assets[r.PathValue("variant")]
	if !ok {
		notFound(w, "")
		return
	}
	etag := `"` + asset.SHA256 + `"`
	w.Header().Set("Cache-Control", "private, max-age=31536000, immutable")
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
