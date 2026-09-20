package battlemap

import "fmt"

type Preset struct {
	ID, Name string
	Document Document
}

// Presets are original editable layouts. External backgrounds carry their own
// provenance in the document and frontend/public/maps/LICENSES.md.
func Presets() []Preset {
	result := []Preset{}
	for _, spec := range []struct{ key, name, base, wall string }{
		{"dungeon", "Забытое подземелье", "stone", "wall-stone"},
		{"tavern", "Таверна у перекрёстка", "wood", "wall-wood"},
		{"crypt", "Склеп хранителей", "slate", "wall-brick"},
		{"caverns", "Пещеры раскалённого разлома", "earth", "wall-rock"},
		{"forest", "Лесная переправа", "grass", "wall-rock"},
		{"ruins", "Руины у оазиса", "sand", "wall-stone"},
	} {
		d := Document{Version: 1, Kind: "tiles", Width: 30, Height: 22, Grid: Grid{Visible: true}, Base: spec.base, Cells: map[string]string{}, Objects: []Object{}, Zones: []Zone{}}
		if spec.key != "forest" && spec.key != "ruins" {
			d.Base = "chasm"
		}
		paint := func(x, y, w, h int, kind string) {
			for yy := y; yy < y+h; yy++ {
				for xx := x; xx < x+w; xx++ {
					d.Cells[fmt.Sprintf("%d,%d", xx, yy)] = kind
				}
			}
		}
		room := func(x, y, w, h int, name string) {
			paint(x, y, w, h, spec.base)
			paint(x, y, w, 1, spec.wall)
			paint(x, y+h-1, w, 1, spec.wall)
			paint(x, y, 1, h, spec.wall)
			paint(x+w-1, y, 1, h, spec.wall)
			d.Zones = append(d.Zones, Zone{ID: fmt.Sprintf("zone-%d", len(d.Zones)), Name: name, Cells: []int{}, Rects: []Rect{{float64(x), float64(y), float64(w), float64(h)}}})
		}
		object := func(kind string, x, y float64, rotation float64) {
			d.Objects = append(d.Objects, Object{ID: fmt.Sprintf("object-%d", len(d.Objects)), Kind: kind, X: x, Y: y, Scale: 1, Rotation: rotation})
		}
		if spec.key == "forest" {
			paint(13, 0, 4, 22, "water")
			paint(0, 9, 30, 3, "earth")
			paint(13, 9, 4, 3, "wood")
			for i := 0; i < 9; i++ {
				object("rubble", float64(3+i%3*9), float64(3+i/3*7), float64(i*30))
			}
			d.Zones = []Zone{{ID: "west", Name: "Западный берег", Cells: []int{}, Rects: []Rect{{0, 0, 13, 22}}}, {ID: "bridge", Name: "Переправа", Cells: []int{}, Rects: []Rect{{13, 0, 4, 22}}}, {ID: "east", Name: "Восточный берег", Cells: []int{}, Rects: []Rect{{17, 0, 13, 22}}}}
		} else {
			room(2, 2, 11, 9, "Входной зал")
			room(17, 2, 11, 9, "Дальняя комната")
			room(2, 13, 11, 7, "Хранилище")
			room(17, 13, 11, 7, "Святилище")
			paint(11, 5, 8, 2, spec.base)
			paint(7, 9, 2, 6, spec.base)
			paint(21, 9, 2, 6, spec.base)
			d.Zones = append(d.Zones, Zone{ID: "corridors", Name: "Переходы", Cells: []int{}, Rects: []Rect{{11, 5, 8, 2}, {7, 9, 2, 6}, {21, 9, 2, 6}}})
			object("door", 12.5, 6, 90)
			object("double-door", 17.5, 6, 90)
			object("door", 8, 13.5, 0)
			object("portcullis", 22, 13.5, 0)
			object("barrel", 4.5, 4.5, 0)
			object("barrel", 5.5, 4.5, 0)
			object("crate", 4.5, 16.5, 0)
			object("chest", 10.5, 17.5, 0)
			object("torch", 3.5, 8.5, 0)
			object("torch", 26.5, 8.5, 0)
			object("stairs", 25, 17, 0)
			if spec.key == "tavern" {
				for i := 0; i < 4; i++ {
					object("table", float64(5+i%2*4), float64(6+i/2*2), 0)
				}
			}
			if spec.key == "crypt" {
				for i := 0; i < 4; i++ {
					object("column", float64(19+i%2*6), float64(4+i/2*4), 0)
				}
			}
			if spec.key == "caverns" {
				paint(14, 0, 2, 22, "chasm")
				paint(14, 11, 2, 9, "lava")
				paint(13, 5, 4, 2, "wood")
			}
			if spec.key == "ruins" {
				paint(18, 14, 6, 4, "water")
				paint(2, 6, 1, 3, "sand")
				object("rubble", 3, 7, 0)
			}
		}
		result = append(result, Preset{"system-" + spec.key, spec.name, d})
	}
	result = append(result,
		Preset{"system-cavern-image", "Подземное озеро · Ferrin", Document{Version: 1, Kind: "image-grid", Width: 40, Height: 40, Grid: Grid{Visible: true}, Base: "stone", Background: Background{URL: "/maps/cavern.png"}, Cells: map[string]string{}, Objects: []Object{}, Zones: []Zone{{ID: "west", Name: "Запад", Cells: []int{}, Rects: []Rect{{0, 0, 20, 40}}}, {ID: "east", Name: "Восток", Cells: []int{}, Rects: []Rect{{20, 0, 20, 40}}}}, Credit: &Credit{Author: "Ferrin", Source: "https://opengameart.org/content/cavern-battlemap", License: "CC0"}}},
		Preset{"system-city", "Речной город", Document{Version: 1, Kind: "image", Width: 40, Height: 30, Grid: Grid{}, Base: "sand", Background: Background{URL: "/maps/city.svg"}, Cells: map[string]string{}, Objects: []Object{}, Zones: []Zone{{ID: "harbor", Name: "Гавань", Cells: []int{}, Rects: []Rect{{0, 0, 14, 30}}}, {ID: "market", Name: "Рынок", Cells: []int{}, Rects: []Rect{{14, 0, 14, 30}}}, {ID: "citadel", Name: "Цитадель", Cells: []int{}, Rects: []Rect{{28, 0, 12, 30}}}}}},
	)
	return result
}
