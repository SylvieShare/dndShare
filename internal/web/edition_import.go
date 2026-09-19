package web

import (
	"dndshare/internal/store"
	"encoding/json"
	"net/http"
)

func (s *Server) toolEditionImport(r *http.Request, args map[string]json.RawMessage) (any, error) {
	var request store.EditionImportRequest
	raw, err := json.Marshal(args)
	if err != nil {
		return nil, err
	}
	if err = json.Unmarshal(raw, &request); err != nil {
		return nil, err
	}
	if request.Apply {
		if err = s.mcpRequireWrite(); err != nil {
			return nil, err
		}
	}
	return s.store.ImportEdition(r.Context(), request)
}
func editionImportDefinition() map[string]any {
	recordProperties := map[string]any{
		"key":              mcpStringProperty("Unique stable import key"),
		"name":             mcpStringProperty("Russian name"),
		"nameEn":           mcpStringProperty("English name"),
		"typeId":           mcpIntegerProperty("Handbook item type"),
		"data":             map[string]any{"type": "object"},
		"originalId":       map[string]any{"type": []string{"integer", "null"}},
		"parentKey":        mcpStringProperty("Base class/species key in this package"),
		"automationStatus": mcpStringProperty("Reviewed automation status"),
		"automationNote":   mcpStringProperty("What is automated and what remains manual"),
	}
	record := map[string]any{
		"type":       "object",
		"required":   []string{"key", "name", "typeId", "data", "automationStatus"},
		"properties": recordProperties,
	}
	return mcpDefinition("handbook_edition_import",
		"Preview and atomically import reviewed concrete versions from a native publication. "+
			"Records use unique keys and {$ref:key} data references. Existing identical import keys "+
			"are preserved, including subsequent editorial edits. Changed keys are rejected: use "+
			"the ordinary editor for corrections. Originals are retained, with legacy replacement "+
			"links in the target edition. Apply requires the exact previewToken. Up to 2500 records.",
		mcpObjectSchema(map[string]any{
			"contentSourceId": mcpIntegerProperty("Native publication"),
			"sourceVersionId": mcpIntegerProperty("Target rules edition"),
			"records":         map[string]any{"type": "array", "items": record},
			"reprints":        map[string]any{"type": "array", "items": map[string]any{"type": "integer"}},
			"decisions":       map[string]any{"type": "array", "items": map[string]any{"type": "object"}},
			"references":      map[string]any{"type": "object", "additionalProperties": map[string]any{"type": "integer"}},
			"apply":           mcpBooleanProperty("Commit the previewed package"),
			"previewToken":    mcpStringProperty("Exact token returned by preview"),
		}, "contentSourceId", "sourceVersionId", "records"))
}
