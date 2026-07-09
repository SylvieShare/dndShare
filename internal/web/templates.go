package web

import (
	"encoding/json"
	"errors"
	"net/http"
	"strconv"

	"dndshare/internal/store"
)

func init() { registerRoutes((*Server).routesTemplates) }

func (s *Server) routesTemplates(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/template-block-types", s.handleBlockTypes)
	mux.HandleFunc("GET /api/template/{id}", s.handleGetTemplate)
	mux.HandleFunc("POST /api/template", s.handleCreateTemplate)
	mux.HandleFunc("PUT /api/template/{id}/schema", s.handleUpdateSchema)
}

// notFoundException повторяет ChangeSetPersister.NotFoundException: не ServerException,
// потому обрабатывается generic-хендлером → 500 {"type":"NotFoundException"} + запись в logs.
func (s *Server) notFoundException(w http.ResponseWriter, r *http.Request) {
	s.store.LogError(r.Context(), r.URL.Path, "NotFoundException", "", "")
	apiError(w, http.StatusInternalServerError, "NotFoundException", "")
}

func (s *Server) handleBlockTypes(w http.ResponseWriter, r *http.Request) {
	if _, ok := mustUser(w, r); !ok {
		return
	}
	types, err := s.store.GetAllBlockTypes(r.Context())
	if err != nil {
		serverError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"types": nonNil(types)})
}

func (s *Server) handleGetTemplate(w http.ResponseWriter, r *http.Request) {
	if _, ok := mustUser(w, r); !ok {
		return
	}
	id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil {
		badRequest(w, "bad id")
		return
	}
	tpl, err := s.store.GetTemplate(r.Context(), id)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			s.notFoundException(w, r)
			return
		}
		serverError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, tpl)
}

func (s *Server) handleCreateTemplate(w http.ResponseWriter, r *http.Request) {
	if _, ok := s.requireRole(w, r, RoleTemplateAdmin); !ok {
		return
	}
	var body struct {
		Name string `json:"name"`
	}
	if err := decodeJSON(r, &body); err != nil {
		badRequest(w, "bad body")
		return
	}
	id, err := s.store.CreateTemplate(r.Context(), body.Name)
	if err != nil {
		serverError(w, err)
		return
	}
	tpl, err := s.store.GetTemplate(r.Context(), id)
	if err != nil {
		serverError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, tpl)
}

func (s *Server) handleUpdateSchema(w http.ResponseWriter, r *http.Request) {
	if _, ok := s.requireRole(w, r, RoleTemplateAdmin); !ok {
		return
	}
	id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil {
		badRequest(w, "bad id")
		return
	}
	var body struct {
		Schema json.RawMessage `json:"schema"`
	}
	if err := decodeJSON(r, &body); err != nil {
		badRequest(w, "bad body")
		return
	}
	if _, err := s.store.GetTemplate(r.Context(), id); err != nil {
		if errors.Is(err, store.ErrNotFound) {
			s.notFoundException(w, r)
			return
		}
		serverError(w, err)
		return
	}
	if err := s.store.UpdateSchema(r.Context(), id, body.Schema); err != nil {
		serverError(w, err)
		return
	}
	writeJSON(w, http.StatusNoContent, nil)
}
