package web

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"

	"dndshare/internal/store"
)

func (s *Server) toolItemCreate(ctx context.Context, args map[string]json.RawMessage) (any, error) {
	if err := s.mcpRequireWrite(); err != nil {
		return nil, err
	}
	typeID, err := argInt64(args, "typeId")
	if err != nil {
		return nil, err
	}
	name, err := argString(args, "name")
	if err != nil {
		return nil, err
	}
	nameEn, err := argString(args, "nameEn")
	if err != nil {
		return nil, err
	}
	dataStr, err := argString(args, "data")
	if err != nil {
		return nil, err
	}
	data, err := parseMcpData(dataStr)
	if err != nil {
		return nil, err
	}
	parentID, err := argInt64Opt(args, "parentId")
	if err != nil {
		return nil, err
	}
	return s.store.CreateBase(ctx, name, nameEn, data, typeID, parentID)
}

func (s *Server) toolItemUpdate(ctx context.Context, args map[string]json.RawMessage) (any, error) {
	if err := s.mcpRequireWrite(); err != nil {
		return nil, err
	}
	id, err := argInt64(args, "id")
	if err != nil {
		return nil, err
	}
	name, err := argString(args, "name")
	if err != nil {
		return nil, err
	}
	nameEn, err := argStringOpt(args, "nameEn")
	if err != nil {
		return nil, err
	}
	dataStr, err := argString(args, "data")
	if err != nil {
		return nil, err
	}
	data, err := parseMcpData(dataStr)
	if err != nil {
		return nil, err
	}
	parentID, err := argInt64Opt(args, "parentId")
	if err != nil {
		return nil, err
	}
	if err := s.store.Update(ctx, id, mcpAdminUser, true, name, nameEn, data); err != nil {
		return nil, err
	}
	if parentID != nil {
		var p *int64
		if *parentID >= 0 {
			p = parentID
		}
		if err := s.store.SetParent(ctx, id, p); err != nil {
			return nil, err
		}
	}
	items, err := s.store.GetByIds(ctx, []int64{id})
	if err != nil {
		return nil, err
	}
	if len(items) == 0 {
		return nil, nil
	}
	return items[0], nil
}

func (s *Server) toolItemDelete(ctx context.Context, args map[string]json.RawMessage) (any, error) {
	if err := s.mcpRequireWrite(); err != nil {
		return nil, err
	}
	id, err := argInt64(args, "id")
	if err != nil {
		return nil, err
	}
	if err := s.store.Delete(ctx, id, mcpAdminUser, true); err != nil {
		return nil, err
	}
	return fmt.Sprintf("deleted item %d", id), nil
}

func (s *Server) toolSuggestCreate(ctx context.Context, args map[string]json.RawMessage) (any, error) {
	if err := s.mcpRequireWrite(); err != nil {
		return nil, err
	}
	typeID, err := argInt64(args, "typeId")
	if err != nil {
		return nil, err
	}
	value, err := argString(args, "value")
	if err != nil {
		return nil, err
	}
	code, err := argStringOpt(args, "code")
	if err != nil {
		return nil, err
	}
	color, err := argStringOpt(args, "color")
	if err != nil {
		return nil, err
	}
	desc, err := argStringOpt(args, "desc")
	if err != nil {
		return nil, err
	}
	return s.store.AddBaseSuggest(ctx, typeID, value, code, desc, color)
}

func (s *Server) toolSuggestUpdate(ctx context.Context, args map[string]json.RawMessage) (any, error) {
	if err := s.mcpRequireWrite(); err != nil {
		return nil, err
	}
	typeID, err := argInt64(args, "typeId")
	if err != nil {
		return nil, err
	}
	id, err := argInt64(args, "id")
	if err != nil {
		return nil, err
	}
	value, err := argString(args, "value")
	if err != nil {
		return nil, err
	}
	code, err := argStringOpt(args, "code")
	if err != nil {
		return nil, err
	}
	color, err := argStringOpt(args, "color")
	if err != nil {
		return nil, err
	}
	desc, err := argStringOpt(args, "desc")
	if err != nil {
		return nil, err
	}
	old, err := s.store.GetEditableSuggest(ctx, id, typeID, mcpAdminUser, true)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			return nil, fmt.Errorf("suggest id=%d type=%d not found", id, typeID)
		}
		return nil, err
	}
	if err := s.store.UpdateSuggest(ctx, id, typeID, mcpAdminUser, true, value, code, color, desc, old.SvgID); err != nil {
		return nil, err
	}
	updated, err := s.store.GetEditableSuggest(ctx, id, typeID, mcpAdminUser, true)
	if err != nil {
		return nil, err
	}
	return updated, nil
}

func (s *Server) toolSuggestSetSvg(ctx context.Context, args map[string]json.RawMessage) (any, error) {
	if err := s.mcpRequireWrite(); err != nil {
		return nil, err
	}
	typeID, err := argInt64(args, "typeId")
	if err != nil {
		return nil, err
	}
	id, err := argInt64(args, "id")
	if err != nil {
		return nil, err
	}
	svg, err := argString(args, "svg")
	if err != nil {
		return nil, err
	}
	old, err := s.store.GetEditableSuggest(ctx, id, typeID, mcpAdminUser, true)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			return nil, fmt.Errorf("suggest id=%d type=%d not found", id, typeID)
		}
		return nil, err
	}
	trimmed := strings.TrimSpace(svg)
	var newSvgID *int64
	if trimmed != "" {
		if !strings.Contains(strings.ToLower(trimmed), "<svg") {
			return nil, errors.New("svg must contain an <svg> element")
		}
		if len([]byte(trimmed)) > 512*1024 {
			return nil, errors.New("svg is too large (max 512 KB)")
		}
		savedID, err := s.store.SaveSuggestSvg(ctx, trimmed)
		if err != nil {
			return nil, err
		}
		newSvgID = &savedID
	}
	if err := s.store.UpdateSuggest(ctx, id, typeID, mcpAdminUser, true, old.Value, old.Code, old.Color, old.Desc, newSvgID); err != nil {
		return nil, err
	}
	if !int64PtrEqual(newSvgID, old.SvgID) && old.SvgID != nil {
		if err := s.store.DeleteSuggestSvg(ctx, *old.SvgID); err != nil {
			return nil, err
		}
	}
	updated, err := s.store.GetEditableSuggest(ctx, id, typeID, mcpAdminUser, true)
	if err != nil {
		return nil, err
	}
	return updated, nil
}

func (s *Server) toolSuggestDelete(ctx context.Context, args map[string]json.RawMessage) (any, error) {
	if err := s.mcpRequireWrite(); err != nil {
		return nil, err
	}
	typeID, err := argInt64(args, "typeId")
	if err != nil {
		return nil, err
	}
	id, err := argInt64(args, "id")
	if err != nil {
		return nil, err
	}
	deleted, err := s.store.DeleteSuggest(ctx, id, typeID, mcpAdminUser, true)
	if err != nil {
		return nil, err
	}
	if deleted {
		return fmt.Sprintf("deleted suggest id=%d type=%d", id, typeID), nil
	}
	return fmt.Sprintf("suggest id=%d type=%d not found", id, typeID), nil
}

// --- argument helpers ---
