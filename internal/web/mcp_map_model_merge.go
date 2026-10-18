package web

import (
	"dndshare/internal/store"
	"encoding/json"
	"fmt"
	"net/http"
)

func (s *Server) toolMapModelMerge(r *http.Request, args map[string]json.RawMessage) (any, error) {
	if err := s.mcpRequireWrite(); err != nil {
		return nil, err
	}
	raw, err := json.Marshal(args)
	if err != nil {
		return nil, err
	}
	var input store.MapModelMerge
	if err = json.Unmarshal(raw, &input); err != nil {
		return nil, err
	}
	if !isUUID(input.SourceID) || !isUUID(input.TargetID) {
		return nil, fmt.Errorf("sourceId and targetId must be model UUIDs")
	}
	result, err := s.store.MergeMapModel(r.Context(), input)
	if err == nil && input.Apply {
		for _, id := range result.SessionIDs {
			s.mapEvents.publish(id)
		}
	}
	return result, err
}
