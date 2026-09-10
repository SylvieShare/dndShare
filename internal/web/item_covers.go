package web

import (
	"bytes"
	"errors"
	"io"
	"log"
	"net/http"
	"strconv"

	"dndshare/internal/store"
)

const maxItemCoverBytes int64 = 5 << 20

func init() { registerRoutes((*Server).routesItemCovers) }

func (s *Server) routesItemCovers(mux *http.ServeMux) {
	mux.HandleFunc("POST /api/items/{id}/cover-image", s.handleUploadItemCoverImage)
	mux.HandleFunc("DELETE /api/items/{id}/cover", s.handleClearItemCover)
}

func (s *Server) handleUploadItemCoverImage(w http.ResponseWriter, r *http.Request) {
	uid, ok := mustUser(w, r)
	if !ok {
		return
	}
	itemID, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil {
		badRequest(w, "bad id")
		return
	}
	isAdmin, ok := s.hasRole(w, r, uid, RoleHandbookAdmin, RoleAdmin)
	if !ok {
		return
	}
	if err := s.store.CanEditItemIcon(r.Context(), itemID, uid, isAdmin); err != nil {
		if errors.Is(err, store.ErrNotFound) {
			unauthorized(w)
			return
		}
		serverError(w, err)
		return
	}

	r.Body = http.MaxBytesReader(w, r.Body, maxItemCoverBytes+1<<20)
	file, header, err := r.FormFile("file")
	if err != nil {
		badRequest(w, "file is required")
		return
	}
	defer file.Close()
	if header.Size <= 0 || header.Size > maxItemCoverBytes {
		badRequest(w, "file must be between 1 byte and 5 MB")
		return
	}

	prefix := make([]byte, 512)
	n, readErr := file.Read(prefix)
	if readErr != nil && !errors.Is(readErr, io.EOF) {
		serverError(w, readErr)
		return
	}
	contentType := http.DetectContentType(prefix[:n])
	if contentType != "image/png" && contentType != "image/webp" && contentType != "image/jpeg" {
		badRequest(w, "only PNG, WebP and JPEG covers are allowed")
		return
	}
	body := io.MultiReader(bytes.NewReader(prefix[:n]), file)
	stored, err := s.s3.UploadImage(r.Context(), body, header.Size, header.Filename, contentType, "")
	if err != nil {
		serverError(w, err)
		return
	}

	imageID, replaced, err := s.store.SetItemCoverImage(
		r.Context(), itemID, uid, isAdmin, stored.Key, stored.URL,
		safeUploadFileName(header.Filename), contentType, header.Size,
	)
	if err != nil {
		if deleteErr := s.s3.DeleteObject(r.Context(), stored.Key); deleteErr != nil {
			log.Printf("delete unattached item cover %q: %v", stored.Key, deleteErr)
		}
		if errors.Is(err, store.ErrNotFound) {
			unauthorized(w)
			return
		}
		serverError(w, err)
		return
	}
	s.cleanupItemIcon(r, replaced)
	writeJSON(w, http.StatusOK, map[string]any{
		"coverImageId":  imageID,
		"coverImageUrl": stored.URL,
	})
}

func (s *Server) handleClearItemCover(w http.ResponseWriter, r *http.Request) {
	uid, ok := mustUser(w, r)
	if !ok {
		return
	}
	itemID, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil {
		badRequest(w, "bad id")
		return
	}
	isAdmin, ok := s.hasRole(w, r, uid, RoleHandbookAdmin, RoleAdmin)
	if !ok {
		return
	}
	refs, err := s.store.ClearItemCover(r.Context(), itemID, uid, isAdmin)
	if errors.Is(err, store.ErrNotFound) {
		unauthorized(w)
		return
	}
	if err != nil {
		serverError(w, err)
		return
	}
	s.cleanupItemIcon(r, refs)
	w.WriteHeader(http.StatusNoContent)
}
