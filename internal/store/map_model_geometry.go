package store

import (
	"encoding/json"

	"dndshare/internal/battlemap"
)

func marshalMapModel(m battlemap.Model) (json.RawMessage, json.RawMessage, error) {
	points := m.PlacementPoints
	if points == nil {
		points = []battlemap.PlacementPoint{}
	}
	geometry, err := json.Marshal(map[string]any{"width": m.Width, "height": m.Height, "mountDepth": m.MountDepth, "surfaceHeight": m.SurfaceHeight, "maxHeight": m.MaxHeight, "blockers": m.Blockers, "tags": m.Tags,
		"hasDecor": m.HasDecor, "canStand": m.CanStand, "hidden": m.Hidden, "placementPoints": points,
		"collectionName": m.CollectionName, "wallMode": m.WallMode, "wallMask": m.WallMask, "supportSlots": m.SupportSlots, "placementOffset": m.PlacementOffset, "textureDetail": m.TextureDetail})
	if err != nil {
		return nil, nil, err
	}
	assets, err := json.Marshal(m.Assets)
	return geometry, assets, err
}
