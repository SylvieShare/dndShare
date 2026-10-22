package web

import (
	"errors"
	"image"
	_ "image/jpeg"
	_ "image/png"
	"io"
	"net/http"
	"strings"

	"dndshare/internal/battlemap"
	"dndshare/internal/store"
	_ "golang.org/x/image/webp"
)

func init() { registerRoutes((*Server).routesSessionMapImages) }
func (s *Server) routesSessionMapImages(mux *http.ServeMux) {
	mux.HandleFunc("POST /api/sessions/{uuid}/map-images", s.mapUserOnly(s.handleCreateImageMap))
	mux.HandleFunc("GET /api/sessions/{uuid}/map-images/{mapId}", s.mapUserOnly(s.handlePrivateMapImage))
	mux.HandleFunc("GET /api/public/sessions/{code}/map-images/{mapId}", s.handlePublicMapImage)
}
func hydrateMapImage(m *store.SessionMap, prefix string) {
	if m.Document.Image != nil {
		m.Document.Image.URL = prefix + "/map-images/" + m.ID
	}
}
func (s *Server) handleCreateImageMap(w http.ResponseWriter, r *http.Request) {
	user, sid, ok := s.mapSession(w, r)
	if !ok {
		return
	}
	var input struct {
		Name    string `json:"name"`
		ImageID int64  `json:"imageId"`
		Width   int    `json:"width"`
	}
	if decodeJSON(r, &input) != nil || input.Width < 2 || input.Width > 160 || strings.TrimSpace(input.Name) == "" || len([]rune(input.Name)) > 160 {
		badRequest(w, "Укажите изображение, название и число клеток")
		return
	}
	record, err := s.store.GetActiveUserStorageImage(r.Context(), input.ImageID, user)
	if err != nil {
		mapError(w, err)
		return
	}
	if record.Key == nil || record.FileSize == nil || *record.FileSize > maxImageBytes {
		badRequest(w, "Некорректное изображение")
		return
	}
	object, err := s.s3.GetObject(r.Context(), *record.Key)
	if err != nil {
		serverError(w, err)
		return
	}
	config, format, err := image.DecodeConfig(io.LimitReader(object.Body, maxImageBytes))
	object.Body.Close()
	if err != nil || (format != "png" && format != "jpeg" && format != "webp") || config.Width < 1 || config.Height < 1 || config.Width > 16384 || config.Height > 16384 || int64(config.Width)*int64(config.Height) > 64000000 {
		badRequest(w, "Используйте PNG, JPEG или WebP до 64 мегапикселей")
		return
	}
	pixels := float64(config.Width) / float64(input.Width)
	height := int(float64(config.Height)/pixels + .999999)
	if height < 2 {
		height = 2
	}
	d := battlemap.Document{Version: battlemap.DocumentVersion, Kind: "image", Width: float64(input.Width), Height: float64(height), Tags: []string{}, Grid: battlemap.Grid{Visible: true}, Image: &battlemap.MapImage{ID: input.ImageID, PixelWidth: config.Width, PixelHeight: config.Height, CellPixels: pixels}}
	if err = battlemap.ValidateDocument(&d); err != nil {
		badRequest(w, err.Error())
		return
	}
	m, err := s.store.AddSessionMap(r.Context(), sid, store.BattleMap{Name: strings.TrimSpace(input.Name), Document: d})
	if err != nil {
		mapError(w, err)
		return
	}
	hydrateMapImage(&m, "/api/sessions/"+r.PathValue("uuid"))
	s.mapEvents.publish(sid)
	writeJSON(w, http.StatusCreated, m)
}
func (s *Server) streamMapImage(w http.ResponseWriter, r *http.Request, m store.SessionMap) {
	if m.Document.Kind != "image" || m.Document.Image == nil {
		notFound(w, "")
		return
	}
	record, err := s.store.GetActiveStorageImage(r.Context(), m.Document.Image.ID)
	if err != nil {
		mapError(w, err)
		return
	}
	if record.Key == nil {
		notFound(w, "")
		return
	}
	object, err := s.s3.GetObject(r.Context(), *record.Key)
	if err != nil {
		serverError(w, err)
		return
	}
	defer object.Body.Close()
	w.Header().Set("Content-Type", object.ContentType)
	w.Header().Set("Cache-Control", "no-store")
	io.Copy(w, object.Body)
}
func (s *Server) handlePrivateMapImage(w http.ResponseWriter, r *http.Request) {
	_, sid, ok := s.mapSession(w, r)
	if !ok {
		return
	}
	id := r.PathValue("mapId")
	if !isUUID(id) {
		notFound(w, "")
		return
	}
	m, err := s.store.GetSessionMap(r.Context(), sid, id)
	if err != nil {
		mapError(w, err)
		return
	}
	s.streamMapImage(w, r, m)
}
func (s *Server) handlePublicMapImage(w http.ResponseWriter, r *http.Request) {
	session, ok := s.publicDisplaySession(w, r)
	if !ok {
		return
	}
	display, err := s.store.GetMapDisplay(r.Context(), session.ID)
	if err != nil {
		mapError(w, err)
		return
	}
	if !display.Visible || display.MapID == nil || *display.MapID != r.PathValue("mapId") {
		notFound(w, "")
		return
	}
	m, err := s.store.GetSessionMap(r.Context(), session.ID, *display.MapID)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			notFound(w, "")
		} else {
			serverError(w, err)
		}
		return
	}
	s.streamMapImage(w, r, m)
}
