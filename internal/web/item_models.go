package web

import (
	"errors"
	"net/http"
	"strconv"

	"dndshare/internal/battlemap"
	"dndshare/internal/store"
)

func init() { registerRoutes((*Server).routesItemModels) }

func (s *Server) routesItemModels(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/items/{id}/model", s.handleItemModel)
	mux.HandleFunc("GET /api/items/{id}/model/{variant}", s.handleItemModelAsset)
	mux.HandleFunc("GET /api/items/{id}/model/base/{variant}", s.handleItemModelBaseAsset)
}

type itemModelAssetView struct {
	ID                string           `json:"id"`
	RenderURL         string           `json:"renderUrl"`
	LODURL            string           `json:"lodUrl"`
	AssetBytes        map[string]int64 `json:"assetBytes"`
	ReferenceDiameter float64          `json:"referenceDiameter"`
}

type itemModelView struct {
	itemModelAssetView
	Base *itemModelBaseView `json:"base,omitempty"`
	Size float64            `json:"size"`
}

type itemModelBaseView struct {
	itemModelAssetView
	SurfaceHeight float64 `json:"surfaceHeight"`
}

func modelAssetView(model battlemap.Model, path string) itemModelAssetView {
	url := func(kind string) string { return path + kind + "?sha=" + model.Assets[kind].SHA256 }
	return itemModelAssetView{ID: model.ID, ReferenceDiameter: model.ReferenceDiameter, RenderURL: url("render"), LODURL: url("lod"),
		AssetBytes: map[string]int64{"render": model.Assets["render"].Size, "lod": model.Assets["lod"].Size}}
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
	path := "/api/items/" + r.PathValue("id") + "/model/"
	view := itemModelView{itemModelAssetView: modelAssetView(model, path)}
	size, err := s.store.ItemModelSize(r.Context(), mustItemID(r))
	if err != nil {
		mapError(w, err)
		return
	}
	view.Size = size
	base, err := s.store.GetHandbookModelBase(r.Context(), size)
	if err != nil && !errors.Is(err, store.ErrNotFound) {
		mapError(w, err)
		return
	}
	if err == nil {
		view.Base = &itemModelBaseView{itemModelAssetView: modelAssetView(base, path+"base/"), SurfaceHeight: base.SurfaceHeight}
	}
	w.Header().Set("Cache-Control", "no-store")
	writeJSON(w, http.StatusOK, view)
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

func (s *Server) handleItemModelBaseAsset(w http.ResponseWriter, r *http.Request) {
	kind := r.PathValue("variant")
	if kind != "render" && kind != "lod" {
		notFound(w, "")
		return
	}
	if _, ok := s.resolveItemModel(w, r); !ok {
		return
	}
	size, err := s.store.ItemModelSize(r.Context(), mustItemID(r))
	if err != nil {
		mapError(w, err)
		return
	}
	base, err := s.store.GetHandbookModelBase(r.Context(), size)
	if err != nil {
		mapError(w, err)
		return
	}
	asset, ok := base.Assets[kind]
	if !ok {
		notFound(w, "")
		return
	}
	s.streamModelAsset(w, r, asset, "public")
}

// Called only after resolveItemModel has validated the path.
func mustItemID(r *http.Request) int64 {
	id, _ := strconv.ParseInt(r.PathValue("id"), 10, 64)
	return id
}
