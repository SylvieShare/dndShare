package store

import (
	"encoding/json"

	"dndshare/internal/battlemap"
)

// Geometry JSON cannot override catalogue columns, even if an upload includes
// unrelated metadata such as name or code.
type mapModelGeometry struct {
	Width             int                        `json:"width"`
	Height            int                        `json:"height"`
	MountDepth        float64                    `json:"mountDepth"`
	MountProfile      string                     `json:"mountProfile,omitempty"`
	SurfaceHeight     float64                    `json:"surfaceHeight"`
	MaxHeight         float64                    `json:"maxHeight"`
	BaseSize          float64                    `json:"baseSize,omitempty"`
	ReferenceDiameter float64                    `json:"referenceDiameter,omitempty"`
	Blockers          [][][2]float64             `json:"blockers"`
	Tags              []string                   `json:"tags"`
	HasDecor          bool                       `json:"hasDecor"`
	CanStand          bool                       `json:"canStand"`
	Hidden            bool                       `json:"hidden"`
	PlacementPoints   []battlemap.PlacementPoint `json:"placementPoints"`
	CollectionName    string                     `json:"collectionName"`
	WallMode          string                     `json:"wallMode"`
	WallMask          int                        `json:"wallMask"`
	SupportSlots      []battlemap.SupportSlot    `json:"supportSlots"`
	PlacementOffset   [2]float64                 `json:"placementOffset"`
	TextureDetail     string                     `json:"textureDetail"`
}

func readMapModelGeometry(raw []byte, m *battlemap.ModelMetadata) error {
	var g mapModelGeometry
	if err := json.Unmarshal(raw, &g); err != nil {
		return err
	}
	m.Width, m.Height, m.MountDepth, m.MountProfile = g.Width, g.Height, g.MountDepth, g.MountProfile
	m.SurfaceHeight, m.MaxHeight, m.Blockers, m.Tags = g.SurfaceHeight, g.MaxHeight, g.Blockers, g.Tags
	m.BaseSize = g.BaseSize
	m.ReferenceDiameter = g.ReferenceDiameter
	m.HasDecor, m.CanStand, m.Hidden, m.PlacementPoints = g.HasDecor, g.CanStand, g.Hidden, g.PlacementPoints
	m.CollectionName, m.WallMode, m.WallMask = g.CollectionName, g.WallMode, g.WallMask
	m.SupportSlots, m.PlacementOffset, m.TextureDetail = g.SupportSlots, g.PlacementOffset, g.TextureDetail
	return nil
}

func marshalMapModel(m battlemap.Model) (json.RawMessage, json.RawMessage, error) {
	points := m.PlacementPoints
	if points == nil {
		points = []battlemap.PlacementPoint{}
	}
	geometry, err := json.Marshal(map[string]any{"width": m.Width, "height": m.Height, "mountDepth": m.MountDepth, "mountProfile": m.MountProfile, "surfaceHeight": m.SurfaceHeight, "maxHeight": m.MaxHeight, "baseSize": m.BaseSize, "blockers": m.Blockers, "tags": m.Tags,
		"referenceDiameter": m.ReferenceDiameter, "hasDecor": m.HasDecor, "canStand": m.CanStand, "hidden": m.Hidden, "placementPoints": points,
		"collectionName": m.CollectionName, "wallMode": m.WallMode, "wallMask": m.WallMask, "supportSlots": m.SupportSlots, "placementOffset": m.PlacementOffset, "textureDetail": m.TextureDetail})
	if err != nil {
		return nil, nil, err
	}
	assets, err := json.Marshal(m.Assets)
	return geometry, assets, err
}
