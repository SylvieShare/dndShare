package web

import (
	"encoding/json"
	"net/http"
)

func init() { registerRoutes((*Server).routesCompatibilityBatch) }
func (s *Server) routesCompatibilityBatch(mux *http.ServeMux) {
	mux.HandleFunc("POST /api/content-sources/compatibility-review", s.handleCompatibilityBatch)
}

type compatibilityBatchRequest struct {
	ContentSourceID int64  `json:"contentSourceId"`
	SourceVersionID int64  `json:"sourceVersionId"`
	Status          string `json:"status"`
	PreviewToken    string `json:"previewToken"`
	Apply           bool   `json:"apply"`
}

func (s *Server) handleCompatibilityBatch(w http.ResponseWriter, r *http.Request) {
	if _, ok := s.requireRole(w, r, RoleAdmin, RoleHandbookAdmin); !ok {
		return
	}
	var req compatibilityBatchRequest
	if err := decodeJSON(r, &req); err != nil {
		badRequest(w, "Некорректный запрос")
		return
	}
	result, err := s.store.ReviewPublicationCompatibility(r.Context(), req.ContentSourceID, req.SourceVersionID, req.Status, req.PreviewToken, req.Apply)
	if err != nil {
		serverError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, result)
}
func (s *Server) toolCompatibilityBatch(r *http.Request, args map[string]json.RawMessage) (any, error) {
	var req compatibilityBatchRequest
	raw, err := json.Marshal(args)
	if err != nil {
		return nil, err
	}
	if err = json.Unmarshal(raw, &req); err != nil {
		return nil, err
	}
	if req.Apply {
		if err = s.mcpRequireWrite(); err != nil {
			return nil, err
		}
	}
	return s.store.ReviewPublicationCompatibility(r.Context(), req.ContentSourceID, req.SourceVersionID, req.Status, req.PreviewToken, req.Apply)
}
func compatibilityBatchDefinition() map[string]any {
	return map[string]any{"name": "handbook_publication_compatibility_review", "description": "Preview unreviewed public entries of a publication for an edition. Existing decisions are preserved. To apply a reviewed batch, pass apply=true and the exact returned token as previewToken. Rejects a stale preview.", "inputSchema": map[string]any{"type": "object", "required": []string{"contentSourceId", "sourceVersionId", "status"}, "properties": map[string]any{
		"contentSourceId": map[string]any{"type": "integer"}, "sourceVersionId": map[string]any{"type": "integer"}, "status": map[string]any{"type": "string", "enum": []string{"compatible", "requires_adaptation", "blocked"}}, "apply": map[string]any{"type": "boolean"}, "previewToken": map[string]any{"type": "string"},
	}}}
}
