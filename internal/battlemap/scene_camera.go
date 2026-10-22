package battlemap

import "fmt"

// Positions use map cells: [x,y,elevation]. Up uses the same axes.
type CameraView struct {
	Position [3]float64 `json:"position"`
	Target   [3]float64 `json:"target"`
	Up       [3]float64 `json:"up"`
	Width    float64    `json:"width"`
	Aspect   float64    `json:"aspect"`
}
type SceneCamera struct {
	ID   string     `json:"id"`
	Name string     `json:"name"`
	View CameraView `json:"view"`
}
type MapImage struct {
	ID          int64   `json:"id"`
	URL         string  `json:"url,omitempty"`
	PixelWidth  int     `json:"pixelWidth"`
	PixelHeight int     `json:"pixelHeight"`
	CellPixels  float64 `json:"cellPixels"`
	OffsetX     float64 `json:"offsetX"`
	OffsetY     float64 `json:"offsetY"`
}

func ValidCameraView(v CameraView) bool {
	if !bounded(v.Width, .25, 2000) || !bounded(v.Aspect, .25, 4) {
		return false
	}
	var distance, up, cross float64
	for i := range 3 {
		if !bounded(v.Position[i], -2000, 2000) || !bounded(v.Target[i], -2000, 2000) || !bounded(v.Up[i], -1, 1) {
			return false
		}
		d := v.Target[i] - v.Position[i]
		distance += d * d
		up += v.Up[i] * v.Up[i]
		j, k := (i+1)%3, (i+2)%3
		c := (v.Target[j]-v.Position[j])*v.Up[k] - (v.Target[k]-v.Position[k])*v.Up[j]
		cross += c * c
	}
	return distance > .0001 && up > .01 && cross > .000001
}
func validateSceneFormat(d *Document) error {
	if d.Kind == "image" {
		i := d.Image
		if i == nil || i.ID <= 0 || i.PixelWidth < 1 || i.PixelHeight < 1 || i.PixelWidth > 16384 || i.PixelHeight > 16384 || i.PixelWidth*i.PixelHeight > 64000000 || !bounded(i.CellPixels, 1, 4096) || !bounded(i.OffsetX, -160, 160) || !bounded(i.OffsetY, -160, 160) || len(d.Tiles)+len(d.Objects)+len(d.Lights)+len(d.Cameras)+len(d.Decals) > 0 {
			return fmt.Errorf("Некорректная 2D-карта")
		}
	} else if d.Image != nil {
		return fmt.Errorf("Изображение доступно только для 2D-карты")
	}
	if len(d.Cameras) > 64 {
		return fmt.Errorf("Не более 64 камер на карте")
	}
	ids := map[string]bool{}
	for _, c := range d.Cameras {
		if !identifier.MatchString(c.ID) || ids[c.ID] || len([]rune(c.Name)) < 1 || len([]rune(c.Name)) > 100 || !ValidCameraView(c.View) {
			return fmt.Errorf("Некорректная камера")
		}
		ids[c.ID] = true
	}
	return nil
}
func ResolveDisplayCamera(d Document, c Camera) Camera {
	for _, camera := range d.Cameras {
		if camera.ID == c.SceneID {
			v := camera.View
			c.View = &v
			break
		}
	}
	return c
}
