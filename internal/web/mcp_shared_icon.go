package web

import (
	"context"
	"encoding/json"
	"fmt"
)

func (s *Server) toolReuseSystemIcon(ctx context.Context, args map[string]json.RawMessage) (any, error) {
	return s.toolReuseSystemMedia(ctx, args, s.store.ReuseSystemItemIcon)
}

func (s *Server) toolReuseSystemCover(ctx context.Context, args map[string]json.RawMessage) (any, error) {
	return s.toolReuseSystemMedia(ctx, args, s.store.ReuseSystemItemCover)
}

func (s *Server) toolReuseSystemMedia(ctx context.Context, args map[string]json.RawMessage, assign func(context.Context, int64, int64) error) (any, error) {
	if err := s.mcpRequireWrite(); err != nil {
		return nil, err
	}
	id, err := argInt64(args, "itemId")
	if err != nil {
		return nil, err
	}
	source, err := argInt64(args, "sourceItemId")
	if err != nil {
		return nil, err
	}
	if id <= 0 || source <= 0 {
		return nil, fmt.Errorf("positive item IDs required")
	}
	if err = assign(ctx, id, source); err != nil {
		return nil, err
	}
	return map[string]any{"itemId": id, "sourceItemId": source}, nil
}
