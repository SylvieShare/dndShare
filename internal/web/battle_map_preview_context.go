package web

import (
	"context"
	"crypto/sha256"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"net/url"
	"sort"
	"time"

	"dndshare/internal/battlemap"
	"dndshare/internal/store"
)

type mapPreviewContext struct {
	Document  battlemap.Document `json:"document"`
	Models    []mapModelView     `json:"models"`
	Signature string             `json:"signature"`
}

func buildMapPreviewContext(d battlemap.Document, models []battlemap.Model, behaviours map[string]battlemap.ModelBehaviour) (mapPreviewContext, error) {
	ids := map[string]bool{}
	for _, t := range d.Tiles {
		ids[t.ModelID] = true
	}
	for _, o := range d.Objects {
		if o.ModelID != "" {
			ids[o.ModelID] = true
		}
	}
	views := []mapModelView{}
	for _, m := range models {
		if ids[m.ID] {
			view := modelView(m, "/api/maps/models")
			view.Behaviour = behaviours[m.DefinitionID]
			views = append(views, view)
		}
	}
	sort.Slice(views, func(i, j int) bool { return views[i].ModelMetadata.ID < views[j].ModelMetadata.ID })
	if len(views) != len(ids) {
		return mapPreviewContext{}, store.ErrInvalidMapModels
	}
	scene := d
	scene.Tags = nil
	scene.Lights = append([]battlemap.Light{}, d.Lights...)
	for i := range scene.Lights {
		scene.Lights[i].Flicker = false
	}
	raw, err := json.Marshal(struct {
		Renderer string
		Document battlemap.Document
		Models   []mapModelView
	}{"map-scene-v1", scene, views})
	if err != nil {
		return mapPreviewContext{}, err
	}
	return mapPreviewContext{Document: d, Models: views, Signature: fmt.Sprintf("%x", sha256.Sum256(raw))}, nil
}
func mapPreviewURL(id, signature string) string {
	return "/api/maps/" + url.PathEscape(id) + "/preview?signature=" + url.QueryEscape(signature)
}
func (s *Server) attachMapPreview(r *http.Request, m *store.BattleMap, models []battlemap.Model, behaviours map[string]battlemap.ModelBehaviour) error {
	data, err := buildMapPreviewContext(m.Document, models, behaviours)
	if err != nil {
		return err
	}
	m.PreviewSignature = data.Signature
	m.PreviewURL = ""
	p, err := s.store.GetMapPreview(r.Context(), m.ID, m.System)
	if errors.Is(err, store.ErrNotFound) {
		return nil
	}
	if err != nil {
		return err
	}
	if p.Signature == data.Signature {
		m.PreviewURL = mapPreviewURL(m.ID, data.Signature)
	}
	return nil
}
func (s *Server) loadMapPreviewContext(r *http.Request, uid int64) (store.BattleMap, mapPreviewContext, error) {
	m, err := s.findMap(r, uid, r.PathValue("mapId"))
	if err != nil {
		return m, mapPreviewContext{}, err
	}
	models, behaviours, err := s.store.HydrateMapCatalogue(r.Context(), &m.Document)
	if err != nil {
		return m, mapPreviewContext{}, err
	}
	data, err := buildMapPreviewContext(m.Document, models, behaviours)
	return m, data, err
}
func (s *Server) removeMapPreviewObject(ctx context.Context, key string) {
	if key == "" {
		return
	}
	cleanup, cancel := context.WithTimeout(context.WithoutCancel(ctx), 10*time.Second)
	defer cancel()
	if err := s.s3.DeleteObject(cleanup, key); err != nil {
		log.Printf("delete map preview: %v", err)
	}
}
