package web

import (
	"net/http"
	"strconv"

	"dndshare/internal/battlemap"
)

func init() { registerRoutes((*Server).routesItemModels) }

func (s *Server) routesItemModels(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/items/{id}/model", s.handleItemModel)
	mux.HandleFunc("GET /api/items/{id}/model/{variant}", s.handleItemModelAsset)
}

type itemModelView struct {
	ID         string           `json:"id"`
	RenderURL  string           `json:"renderUrl"`
	LODURL     string           `json:"lodUrl"`
	AssetBytes map[string]int64 `json:"assetBytes"`
}

func (s *Server) resolveItemModel(w http.ResponseWriter, r *http.Request) (battlemap.Model, bool) {
	id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil || id <= 0 {
		badRequest(w, "bad item id")
		return battlemap.Model{}, false
	}
	model, err := s.store.GetItemModel(r.Context(), id)
	if err != nil {
		mapError(w, err)
		return model, false
	}
	return model, true
}

func (s *Server) handleItemModel(w http.ResponseWriter, r *http.Request) {
	model, ok := s.resolveItemModel(w, r)
	if !ok {
		return
	}
	base := "/api/items/" + r.PathValue("id") + "/model/"
	url := func(kind string) string { return base + kind + "?sha=" + model.Assets[kind].SHA256 }
	w.Header().Set("Cache-Control", "no-store")
	writeJSON(w, http.StatusOK, itemModelView{ID: model.ID, RenderURL: url("render"), LODURL: url("lod"),
		AssetBytes: map[string]int64{"render": model.Assets["render"].Size, "lod": model.Assets["lod"].Size}})
}

func (s *Server) handleItemModelAsset(w http.ResponseWriter, r *http.Request) {
	kind := r.PathValue("variant")
	if kind != "render" && kind != "lod" {
		notFound(w, "")
		return
	}
	model, ok := s.resolveItemModel(w, r)
	if !ok {
		return
	}
	asset, ok := model.Assets[kind]
	if !ok {
		notFound(w, "")
		return
	}
	s.streamModelAsset(w, r, asset, "public")
}
