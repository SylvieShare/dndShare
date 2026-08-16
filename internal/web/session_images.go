package web

import (
	"net/http"

	"dndshare/internal/store"
)

func init() { registerRoutes((*Server).routesSessionImages) }

func (s *Server) routesSessionImages(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/session-images", s.handleListSessionImages)
}

type sessionImagesResponse struct {
	Images []store.SessionImageCatalogEntry `json:"images"`
}

func (s *Server) handleListSessionImages(w http.ResponseWriter, r *http.Request) {
	if _, ok := mustUser(w, r); !ok {
		return
	}
	scope := r.URL.Query().Get("scope")
	if scope != "story" && scope != "npc" {
		badRequest(w, "Некорректный каталог изображений")
		return
	}
	images, err := s.store.ListSessionImageCatalog(r.Context(), scope)
	if err != nil {
		serverError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, sessionImagesResponse{Images: images})
}

func (s *Server) validateSessionImage(
	w http.ResponseWriter,
	r *http.Request,
	userID, imageID int64,
	scope string,
) bool {
	if imageID <= 0 {
		badRequest(w, "Выберите изображение")
		return false
	}
	allowed, err := s.store.UserCanUseSessionImage(r.Context(), imageID, userID, scope)
	if err != nil {
		serverError(w, err)
		return false
	}
	if !allowed {
		badRequest(w, "Изображение недоступно")
		return false
	}
	return true
}
