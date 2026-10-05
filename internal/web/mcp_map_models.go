package web

import (
	"encoding/json"
	"errors"
	"net/http"
	"strings"

	"dndshare/internal/battlemap"
)

func (s *Server) toolMapModels(r *http.Request, name string, args map[string]json.RawMessage) (any, error) {
	switch name {
	case "map_tile_models_list":
		collection, err := argStringOpt(args, "collection")
		if err != nil {
			return nil, err
		}
		models, err := s.store.ListMapModels(r.Context())
		if err != nil {
			return nil, err
		}
		if collection != nil {
			filtered := []battlemap.Model{}
			for _, m := range models {
				if m.Collection == *collection {
					filtered = append(filtered, m)
				}
			}
			models = filtered
		}
		return models, nil
	case "map_tile_model_get":
		id, err := argString(args, "id")
		if err != nil {
			return nil, err
		}
		if !isUUID(id) {
			return nil, errors.New("model UUID required")
		}
		return s.store.GetMapModel(r.Context(), id)
	case "map_tile_model_register":
		if err := s.mcpRequireWrite(); err != nil {
			return nil, err
		}
		var model battlemap.Model
		if err := json.Unmarshal(args["model"], &model); err != nil {
			return nil, errors.New("model must be a complete JSON object")
		}
		if err := validateMapModel(model); err != nil {
			return nil, err
		}
		for kind, asset := range model.Assets {
			args := map[string]json.RawMessage{}
			for key, value := range map[string]any{"kind": kind, "fileName": asset.FileName, "size": asset.Size, "sha256": asset.SHA256} {
				args[key], _ = json.Marshal(value)
			}
			_, expected, err := parseMapAsset(args)
			if err != nil {
				return nil, err
			}
			if expected != asset {
				return nil, errors.New("asset metadata differs from upload result")
			}
			if err = s.verifyMapAsset(r, asset.Key, asset); err != nil {
				return nil, err
			}
		}
		return s.store.RegisterMapModel(r.Context(), model)
	}
	return nil, errors.New("unknown map model tool")
}

func validateMapModel(m battlemap.Model) error {
	if !isUUID(m.ID) || m.Collection == "" || m.SourceCode == "" || m.SourceName == "" || strings.TrimSpace(m.Name) == "" || m.Version < 1 || len([]rune(m.Name)) > 160 || len(m.Collection) > 80 || len(m.SourceCode) > 80 || len(m.SourceName) > 255 {
		return errors.New("invalid model identity or names")
	}
	if m.TileType != "floor" && m.TileType != "wall" && m.TileType != "prop" && m.TileType != "stairs" && m.TileType != "frame" {
		return errors.New("invalid tileType")
	}
	if m.CollectionName == "" || len(m.CollectionName) > 160 || (m.WallMode != "center" && m.WallMode != "edge" && m.WallMode != "none") || m.WallMask < 0 || m.WallMask > 255 {
		return errors.New("invalid collection label or wall controls")
	}
	if m.TerrainType == "" || len(m.TerrainType) > 32 || len(m.WallLayout) > 32 || m.Width < 1 || m.Height < 1 || m.Width > 8 || m.Height > 8 || m.SurfaceHeight < 0 || m.MaxHeight < m.SurfaceHeight || m.MaxHeight > 32 {
		return errors.New("invalid model geometry")
	}
	if len(m.Blockers) > 100 || len(m.Tags) > 32 {
		return errors.New("too many geometry contours or tags")
	}
	if len(m.SupportSlots) > 64 {
		return errors.New("too many support slots")
	}
	for i, slot := range m.SupportSlots {
		if slot.X < 0 || slot.Y < 0 || slot.Width < 1 || slot.Height < 1 || slot.X+slot.Width > m.Width || slot.Y+slot.Height > m.Height || slot.Elevation <= 0 || slot.Elevation > m.MaxHeight+.001 {
			return errors.New("invalid support slot")
		}
		for _, other := range m.SupportSlots[:i] {
			if slot.X < other.X+other.Width && slot.X+slot.Width > other.X && slot.Y < other.Y+other.Height && slot.Y+slot.Height > other.Y {
				return errors.New("overlapping support slots")
			}
		}
	}
	for _, p := range m.Blockers {
		if len(p) < 3 || len(p) > 500 {
			return errors.New("invalid blocker polygon")
		}
		for _, v := range p {
			if v[0] < -.01 || v[1] < -.01 || v[0] > float64(m.Width)+.01 || v[1] > float64(m.Height)+.01 {
				return errors.New("blocker point outside footprint")
			}
		}
	}
	if len(m.Assets) != 4 {
		return errors.New("four model assets required")
	}
	for _, key := range []string{"render", "lod", "preview", "source"} {
		if _, ok := m.Assets[key]; !ok {
			return errors.New("missing model asset " + key)
		}
	}
	return nil
}
