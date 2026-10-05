package store

import (
	"encoding/json"

	"dndshare/internal/battlemap"
)

func marshalMapModel(m battlemap.Model) (json.RawMessage, json.RawMessage, error) {
	geometry, err := json.Marshal(map[string]any{"width": m.Width, "height": m.Height, "mountDepth": m.MountDepth, "surfaceHeight": m.SurfaceHeight, "maxHeight": m.MaxHeight, "blockers": m.Blockers, "tags": m.Tags,
		"collectionName": m.CollectionName, "wallMode": m.WallMode, "wallMask": m.WallMask, "supportSlots": m.SupportSlots, "placementOffset": m.PlacementOffset})
	if err != nil {
		return nil, nil, err
	}
	assets, err := json.Marshal(m.Assets)
	return geometry, assets, err
}
