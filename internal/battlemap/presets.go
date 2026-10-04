package battlemap

import "fmt"

type Preset struct {
	ID, Name string
	Document Document
}

func Presets() []Preset {
	makeDocument := func(width, height float64) Document {
		return Document{Version: DocumentVersion, Kind: "tiles", Width: width, Height: height,
			Grid: Grid{Visible: true}, Tiles: []Tile{}, Objects: []Object{}, Zones: []Zone{}}
	}
	cave := makeDocument(20, 14)
	put := func(x, y int, code string, rotation int) {
		cave.Tiles = append(cave.Tiles, Tile{ID: fmt.Sprintf("tile-%d-%d", x, y), ModelID: InitialModelID(code), X: x, Y: y, Rotation: rotation})
	}
	for y := 2; y < 12; y++ {
		for x := 2; x < 18; x++ {
			code, rotation := "LC-007", 0
			switch {
			case y == 2:
				code = "LC-001"
			case y == 11:
				code = "LC-002"
				rotation = 180
			case x == 2:
				code = "LC-001"
				rotation = 270
			case x == 17:
				code = "LC-002"
				rotation = 90
			case (x == 5 && y == 5) || (x == 14 && y == 8):
				code = "LC-010"
			case (x+y)%5 == 0:
				code = "LC-008"
			}
			put(x, y, code, rotation)
		}
	}
	cave.Zones = []Zone{{ID: "west", Name: "Входной зал", Cells: []int{}, Rects: []Rect{{2, 2, 8, 10}}},
		{ID: "east", Name: "Дальний зал", Cells: []int{}, Rects: []Rect{{10, 2, 8, 10}}}}
	image := makeDocument(40, 40)
	image.Kind = "image-grid"
	image.Background = Background{URL: "/maps/cavern.png"}
	image.Credit = &Credit{Author: "Ferrin", Source: "https://opengameart.org/content/cavern-battlemap", License: "CC0"}
	city := makeDocument(40, 30)
	city.Kind = "image"
	city.Grid.Visible = false
	city.Background = Background{URL: "/maps/city.svg"}
	return []Preset{{"system-cave", "Пещерные залы", cave},
		{"system-stalagmites", "Пустая пещера", makeDocument(24, 18)},
		{"system-cavern-image", "Подземное озеро · Ferrin", image},
		{"system-city", "Речной город", city}}
}
