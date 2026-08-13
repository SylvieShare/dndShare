package web

import (
	"bytes"
	"context"
	"errors"
	"io"
	"log"
	"net/http"
	"strconv"

	"dndshare/internal/store"
)

const maxItemIconBytes int64 = 5 << 20

func init() { registerRoutes((*Server).routesItemIcons) }

func (s *Server) routesItemIcons(mux *http.ServeMux) {
	mux.HandleFunc("POST /api/items/{id}/icon-image", s.handleUploadItemIconImage)
	mux.HandleFunc("DELETE /api/items/{id}/icon", s.handleClearItemIcon)
}

func (s *Server) handleUploadItemIconImage(w http.ResponseWriter, r *http.Request) {
	uid, ok := mustUser(w, r)
	if !ok {
		return
	}
	itemID, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil {
		badRequest(w, "bad id")
		return
	}
	isAdmin, ok := s.hasRole(w, r, uid, RoleHandbookAdmin)
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

	r.Body = http.MaxBytesReader(w, r.Body, maxItemIconBytes+1<<20)
	file, header, err := r.FormFile("file")
	if err != nil {
		badRequest(w, "file is required")
		return
	}
	defer file.Close()
	if header.Size <= 0 || header.Size > maxItemIconBytes {
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
	if contentType != "image/png" && contentType != "image/webp" {
		badRequest(w, "only PNG and WebP icons are allowed")
		return
	}
	body := io.MultiReader(bytes.NewReader(prefix[:n]), file)
	stored, err := s.s3.UploadImage(r.Context(), body, header.Size, header.Filename, contentType, "")
	if err != nil {
		serverError(w, err)
		return
	}

	imageID, replaced, err := s.store.SetItemIconImage(r.Context(), itemID, uid, isAdmin, stored.Key, stored.URL)
	if err != nil {
		if deleteErr := s.s3.DeleteObject(r.Context(), stored.Key); deleteErr != nil {
			log.Printf("delete unattached item icon %q: %v", stored.Key, deleteErr)
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
		"iconImageId":  imageID,
		"iconImageUrl": stored.URL,
	})
}

func (s *Server) handleClearItemIcon(w http.ResponseWriter, r *http.Request) {
	uid, ok := mustUser(w, r)
	if !ok {
		return
	}
	itemID, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil {
		badRequest(w, "bad id")
		return
	}
	isAdmin, ok := s.hasRole(w, r, uid, RoleHandbookAdmin)
	if !ok {
		return
	}
	refs, err := s.store.ClearItemIcon(r.Context(), itemID, uid, isAdmin)
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

func (s *Server) cleanupItemIcon(r *http.Request, refs store.ItemIconRefs) {
	s.cleanupItemIconContext(r.Context(), refs)
}

func (s *Server) cleanupItemIconContext(ctx context.Context, refs store.ItemIconRefs) {
	if refs.SVGID != nil {
		if err := s.store.DeleteSvgIfUnreferenced(ctx, *refs.SVGID); err != nil {
			log.Printf("delete orphaned item svg %d: %v", *refs.SVGID, err)
		}
	}
	if refs.ImageID == nil {
		return
	}
	key, err := s.store.MarkStorageImageDeletedIfUnreferenced(ctx, *refs.ImageID)
	if err != nil {
		log.Printf("mark orphaned item image %d deleted: %v", *refs.ImageID, err)
		return
	}
	if key != nil {
		if err := s.s3.DeleteObject(ctx, *key); err != nil {
			log.Printf("delete orphaned item image %d (%q): %v", *refs.ImageID, *key, err)
		}
	}
}
