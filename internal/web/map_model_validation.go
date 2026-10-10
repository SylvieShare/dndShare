package web

import (
	"errors"
	"math"
	"regexp"
	"strings"

	"dndshare/internal/battlemap"
)

var mapMountProfile = regexp.MustCompile(`^[a-z][a-z0-9-]{0,63}$`)

func validateMapModel(m battlemap.Model) error {
	if m.TextureDetail != "basic" && m.TextureDetail != "detailed" {
		return errors.New("invalid textureDetail; expected basic or detailed")
	}
	if !isUUID(m.ID) || m.Collection == "" || m.SourceCode == "" || m.SourceName == "" || strings.TrimSpace(m.Name) == "" || len([]rune(m.Name)) > 160 || len(m.Collection) > 80 || len(m.SourceCode) > 80 || len(m.SourceName) > 255 {
		return errors.New("invalid model identity or names")
	}
	if !battlemap.ValidTileType(m.TileType) {
		return errors.New("invalid tileType")
	}
	if m.CollectionName == "" || len(m.CollectionName) > 160 || (m.WallMode != "center" && m.WallMode != "edge" && m.WallMode != "none") || m.WallMask < 0 || m.WallMask > 255 {
		return errors.New("invalid collection label or wall controls")
	}
	if m.Width < 1 || m.Height < 1 || m.Width > 8 || m.Height > 8 || m.SurfaceHeight < 0 || m.MaxHeight < m.SurfaceHeight || m.MaxHeight > 32 {
		return errors.New("invalid model geometry")
	}
	if math.IsNaN(m.SurfaceHeight) || math.IsInf(m.SurfaceHeight, 0) || math.IsNaN(m.MaxHeight) || math.IsInf(m.MaxHeight, 0) {
		return errors.New("invalid model height")
	}
	if math.IsNaN(m.MountDepth) || math.IsInf(m.MountDepth, 0) || m.MountDepth < 0 || m.MountDepth > m.SurfaceHeight {
		return errors.New("invalid model mounting depth")
	}
	if m.MountProfile != "" && (!mapMountProfile.MatchString(m.MountProfile) || m.MountDepth == 0) {
		return errors.New("invalid model mount profile")
	}
	for _, offset := range m.PlacementOffset {
		if math.IsNaN(offset) || math.IsInf(offset, 0) || math.Abs(offset) > 8 {
			return errors.New("invalid model placement offset")
		}
	}
	if len(m.Blockers) > 100 || len(m.Tags) > 32 {
		return errors.New("too many geometry contours or tags")
	}
	for _, tag := range m.Tags {
		if strings.TrimSpace(tag) == "" || len([]rune(tag)) > 64 {
			return errors.New("invalid model tag")
		}
	}
	if len(m.PlacementPoints) > 256 {
		return errors.New("too many placement points")
	}
	for _, point := range m.PlacementPoints {
		if math.IsNaN(point.X) || math.IsInf(point.X, 0) || math.IsNaN(point.Y) || math.IsInf(point.Y, 0) || math.IsNaN(point.Elevation) || math.IsInf(point.Elevation, 0) || point.X < 0 || point.X > float64(m.Width) || point.Y < 0 || point.Y > float64(m.Height) || point.Elevation < m.MountDepth || point.Elevation > m.MaxHeight+.001 {
			return errors.New("invalid placement point")
		}
	}
	if len(m.SupportSlots) > 64 {
		return errors.New("too many support slots")
	}
	for i, slot := range m.SupportSlots {
		if len(slot.InsertionRises) > 16 || (len(slot.InsertionRises) > 0 && m.TileType != "frame") {
			return errors.New("invalid support slot mounting profiles")
		}
		for profile, rise := range slot.InsertionRises {
			if !mapMountProfile.MatchString(profile) || math.IsNaN(rise) || math.IsInf(rise, 0) || rise < 0 || rise > .1 {
				return errors.New("invalid support slot profile rise")
			}
		}
		if math.IsNaN(slot.InsertionRise) || math.IsInf(slot.InsertionRise, 0) || slot.InsertionRise < 0 || slot.InsertionRise > .1 || (slot.InsertionRise > 0 && m.TileType != "frame") {
			return errors.New("invalid support slot insertion rise")
		}
		if math.IsNaN(slot.Elevation) || math.IsInf(slot.Elevation, 0) || slot.X < 0 || slot.Y < 0 || slot.Width < 1 || slot.Height < 1 || slot.X+slot.Width > m.Width || slot.Y+slot.Height > m.Height || slot.Elevation <= m.MountDepth || slot.Elevation > m.MaxHeight+.001 {
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
			if math.IsNaN(v[0]) || math.IsNaN(v[1]) || math.IsInf(v[0], 0) || math.IsInf(v[1], 0) || v[0] < -.01 || v[1] < -.01 || v[0] > float64(m.Width)+.01 || v[1] > float64(m.Height)+.01 {
				return errors.New("blocker point outside footprint")
			}
		}
	}
	if len(m.Assets) != 5 {
		return errors.New("five model assets required")
	}
	for _, key := range []string{"render", "lod", "preview", "source", "shadow"} {
		if _, ok := m.Assets[key]; !ok {
			return errors.New("missing model asset " + key)
		}
	}
	return nil
}
