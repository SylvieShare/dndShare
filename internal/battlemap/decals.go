package battlemap

import (
	"fmt"
	"math"
	"regexp"
)

// Position and Normal use the owner's model coordinates, including its part
// transforms. Moving an instance never changes its decal's projection.
type Decal struct {
	ID       string      `json:"id"`
	Name     string      `json:"name"`
	Category string      `json:"category"`
	ImageURL string      `json:"imageUrl"`
	Anchor   LightAnchor `json:"anchor"`
	Position [3]float64  `json:"position"`
	Normal   [3]float64  `json:"normal"`
	Width    float64     `json:"width"`
	Height   float64     `json:"height"`
	Depth    float64     `json:"depth"`
	Rotation float64     `json:"rotation"`
	Opacity  float64     `json:"opacity"`
	Color    string      `json:"color"`
}

var decalImageURL = regexp.MustCompile(`^/api/map-decal-images/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$`)
var builtinDecalURL = regexp.MustCompile(`^/images/maps/decals/(blood-splash|blood-pool|mud|rune|arrow|wanted)\.svg$`)

func DecalCategory(category string) bool {
	return category == "traces" || category == "graffiti" || category == "posters" || category == "custom"
}

func validateDecals(d *Document, tiles, objects map[string]bool) error {
	if len(d.Decals) > 512 {
		return fmt.Errorf("Не больше 512 декалей на карте")
	}
	ids := map[string]bool{}
	for _, decal := range d.Decals {
		owner := decal.Anchor.Kind == "tile" && tiles[decal.Anchor.ID] || decal.Anchor.Kind == "object" && objects[decal.Anchor.ID]
		if !identifier.MatchString(decal.ID) || ids[decal.ID] || !owner || len([]rune(decal.Name)) > 100 ||
			!DecalCategory(decal.Category) || (!decalImageURL.MatchString(decal.ImageURL) && !builtinDecalURL.MatchString(decal.ImageURL)) ||
			!bounded(decal.Width, .02, 16) || !bounded(decal.Height, .02, 16) || !bounded(decal.Depth, .01, 2) ||
			!bounded(decal.Rotation, -360, 360) || !bounded(decal.Opacity, 0, 1) || !color.MatchString(decal.Color) {
			return fmt.Errorf("Некорректная декаль карты")
		}
		length := 0.0
		for i := range 3 {
			if !bounded(decal.Position[i], -256, 256) || !bounded(decal.Normal[i], -1, 1) {
				return fmt.Errorf("Некорректная поверхность декали")
			}
			length += decal.Normal[i] * decal.Normal[i]
		}
		if math.Abs(length-1) > .01 {
			return fmt.Errorf("Некорректная нормаль декали")
		}
		ids[decal.ID] = true
	}
	return nil
}
