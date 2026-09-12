package web

import (
	"context"
	"dndshare/internal/store"
	"encoding/json"
)

func (s *Server) toolItemSetContentSources(ctx context.Context, args map[string]json.RawMessage) (any, error) {
	if err := s.mcpRequireWrite(); err != nil {
		return nil, err
	}
	id, err := argInt64(args, "id")
	if err != nil {
		return nil, err
	}
	sources, err := argInt64Slice(args, "contentSourceIds")
	if err != nil {
		return nil, err
	}
	if err := s.store.SetItemContentSources(ctx, id, mcpAdminUser, true, sources); err != nil {
		return nil, err
	}
	items, err := s.store.GetByIds(ctx, []int64{id}, nil)
	if err != nil {
		return nil, err
	}
	if len(items) == 0 {
		return nil, store.ErrNotFound
	}
	return items[0], nil
}
