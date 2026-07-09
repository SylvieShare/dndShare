package web

import (
	"net/http"
	"strings"
)

func init() { registerRoutes((*Server).routesText) }

func (s *Server) routesText(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/text", s.handleGetText)
}

func (s *Server) handleGetText(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	if !q.Has("keysets") || !q.Has("lang") {
		badRequest(w, "")
		return
	}
	var keysets []string
	for _, raw := range q["keysets"] {
		for _, ks := range strings.Split(raw, ",") {
			ks = strings.TrimSpace(ks)
			if ks != "" {
				keysets = append(keysets, ks)
			}
		}
	}
	lang := q.Get("lang")
	items, err := s.store.FindTextByKeysetsAndLang(r.Context(), keysets, lang)
	if err != nil {
		serverError(w, err)
		return
	}
	grouped := map[string]map[string]string{}
	for _, it := range items {
		m, ok := grouped[it.Keyset]
		if !ok {
			m = map[string]string{}
			grouped[it.Keyset] = m
		}
		m[it.Key] = it.Value
	}
	writeJSON(w, http.StatusOK, map[string]any{"keysets": grouped})
}
