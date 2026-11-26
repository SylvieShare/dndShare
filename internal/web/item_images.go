package web

import (
	"bytes"
	"context"
	"errors"
	"io"
	"log"
	"net/http"

	"dndshare/internal/store"
)

const maxItemImageBytes int64 = 5 << 20

type itemImageSlot struct {
	name        string
	allowJPEG   bool
	formatError string
	set         func(*store.Store, context.Context, int64, int64, bool, string, string, string, string, int64) (int64, store.ItemIconRefs, error)
	clear       func(*store.Store, context.Context, int64, int64, bool) (store.ItemIconRefs, error)
}

func init() { registerRoutes((*Server).routesItemImages) }

func (s *Server) routesItemImages(mux *http.ServeMux) {
	s.registerItemImageSlot(mux, itemImageSlot{
		name:        "icon",
		formatError: "only PNG and WebP icons are allowed",
		set:         (*store.Store).SetItemIconImage,
		clear:       (*store.Store).ClearItemIcon,
	})
	s.registerItemImageSlot(mux, itemImageSlot{
		name:        "cover",
		allowJPEG:   true,
		formatError: "only PNG, WebP and JPEG covers are allowed",
		set:         (*store.Store).SetItemCoverImage,
		clear:       (*store.Store).ClearItemCover,
	})
}

func (s *Server) registerItemImageSlot(mux *http.ServeMux, slot itemImageSlot) {
	mux.HandleFunc("POST /api/items/{id}/"+slot.name+"-image", func(w http.ResponseWriter, r *http.Request) {
		s.uploadItemImage(w, r, slot)
	})
	mux.HandleFunc("DELETE /api/items/{id}/"+slot.name, func(w http.ResponseWriter, r *http.Request) {
		s.clearItemImage(w, r, slot)
	})
}

func (s *Server) uploadItemImage(w http.ResponseWriter, r *http.Request, slot itemImageSlot) {
	uid, ok := mustUser(w, r)
	if !ok {
		return
	}
	itemID, ok := pathInt64(w, r, "id")
	if !ok {
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

	r.Body = http.MaxBytesReader(w, r.Body, maxItemImageBytes+1<<20)
	file, header, err := r.FormFile("file")
	if err != nil {
		badRequest(w, "file is required")
		return
	}
	defer file.Close()
	if header.Size <= 0 || header.Size > maxItemImageBytes {
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
	if contentType != "image/png" && contentType != "image/webp" && !(slot.allowJPEG && contentType == "image/jpeg") {
		badRequest(w, slot.formatError)
		return
	}
	body := io.MultiReader(bytes.NewReader(prefix[:n]), file)
	stored, err := s.s3.UploadImage(r.Context(), body, header.Size, header.Filename, contentType, "")
	if err != nil {
		serverError(w, err)
		return
	}

	imageID, replaced, err := slot.set(s.store,
		r.Context(), itemID, uid, isAdmin, stored.Key, stored.URL,
		safeUploadFileName(header.Filename), contentType, header.Size,
	)
	if err != nil {
		if deleteErr := s.s3.DeleteObject(r.Context(), stored.Key); deleteErr != nil {
			log.Printf("delete unattached item %s %q: %v", slot.name, stored.Key, deleteErr)
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
		slot.name + "ImageId":  imageID,
		slot.name + "ImageUrl": stored.URL,
	})
}

func (s *Server) clearItemImage(w http.ResponseWriter, r *http.Request, slot itemImageSlot) {
	uid, ok := mustUser(w, r)
	if !ok {
		return
	}
	itemID, ok := pathInt64(w, r, "id")
	if !ok {
		return
	}
	isAdmin, ok := s.hasRole(w, r, uid, RoleHandbookAdmin, RoleAdmin)
	if !ok {
		return
	}
	refs, err := slot.clear(s.store, r.Context(), itemID, uid, isAdmin)
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
	s.cleanupItemStorageImage(ctx, refs.ImageID)
	s.cleanupItemStorageImage(ctx, refs.CoverImageID)
}

func (s *Server) cleanupItemStorageImage(ctx context.Context, imageID *int64) {
	if imageID == nil {
		return
	}
	key, err := s.store.MarkStorageImageDeletedIfUnreferenced(ctx, *imageID)
	if err != nil {
		log.Printf("mark orphaned item image %d deleted: %v", *imageID, err)
		return
	}
	if key != nil {
		if err := s.s3.DeleteObject(ctx, *key); err != nil {
			log.Printf("delete orphaned item image %d (%q): %v", *imageID, *key, err)
		}
	}
}
